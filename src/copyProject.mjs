import chalk from 'chalk';

import { loadProject, updateProject, projectInfo } from './projectFile.mjs';
import referenceTracer from './referenceTracer.mjs';
import { stackTitle } from './utils.mjs';

const { gray, bold, blue } = chalk;

function idGenerator(project) {
  const { broadcasts } = project.targets[0];
  const { blocks, variables, lists } = project.targets[1];

  const idSet = new Set(
    [broadcasts, blocks, variables, lists].map((c) => Object.keys(c)).flat()
  );

  const genId = () => {
    const idDict = '!#$%()*+,-./0123456789:;?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^`abcdefghijklmnopqrstuvwxyz{|}~';
    const result = [];
    for(let i=0; i< 20; i++) {
      result.push(idDict[Math.floor(Math.random() * idDict.length)]);
    }
    return result.join('');
  }

  return () => {
    let id;
    do {
      id = genId();
    } while (idSet.has(id));

    idSet.add(id);
    return id;
  }
}

function logOperation(op, description, id) {
  console.log(
    [ 
      '   ',
      blue(op.padEnd(10, ' ')),
      gray(description.padEnd(10, ' ')),
      id
    ].join(' ')
  );
}

function stackRootBlock (blocks, block) {
  while (block.parent) {
    block = blocks[block.parent];
  }

  return block;
}

export default async function copyProjects(source, target, output, stackSelector) {
  const sourceProject = await loadProject(source);
  
  await updateProject(target, output, async (project) => {

    const { variables, lists, blocks, comments } = project.targets[1]; 
    const { broadcasts } = project.targets[0];

    const { blocks: sourceBlocks, comments: sourceComments } = sourceProject.targets[1]; 
    const sourceInfo = projectInfo(sourceProject);
    const origInfo = projectInfo(project);

    const stacks = stackSelector(sourceProject, project);

    console.log('');
    console.log([
      gray('Copy stacks from'),
      bold(source),
      'to',
      bold(target),
      gray(':'),
    ].join(' '));

    console.log('');
    stacks.forEach((stack) => {
      console.log(`    ${stackTitle(stack)}`);
    })
    console.log('');
    console.log(gray('Perform project merge:'));
    console.log('');


    const tracer = referenceTracer(sourceProject, { followProcedures: true });
    stacks.forEach((stack) => {
      tracer.add(stack.id);
    })
    const refs = tracer.usage();

    const idMap = {}; // src -> target
    const genId = idGenerator(project);

    // ------------------------------------------------------------------------
    //  Calculate relative coordinates of ALL source comments 
    // ------------------------------------------------------------------------
    Object.values(sourceComments).forEach((comment) => {
      const commentBlock = sourceBlocks[comment.blockId];
      if (commentBlock) {
        const rootBlock = stackRootBlock(sourceBlocks, sourceBlocks[comment.blockId]);
        comment.x -= rootBlock.x;
        comment.y -= rootBlock.y;
        comment.relative = true;
      }
    });

    // ------------------------------------------------------------------------
    //  Copy variables, if necessary
    // ------------------------------------------------------------------------
    const varList = Object.entries(variables);
    Object.entries(refs.variables).forEach(([id, info]) => {
      const orig = varList.find(([,[origName]]) => origName === info.name);

      if (orig) {
        logOperation('LINK', 'variable', info.name);
        idMap[id] = orig[0]; // re-use variable from the origin
      } else {
        logOperation('COPY', 'variable', info.name);
        const newId = genId();
        idMap[id] = newId;
        variables[newId] = info.data; // Copy variable
      }
    });

    // ------------------------------------------------------------------------
    //  Copy lists, if necessary
    // ------------------------------------------------------------------------
    const listList = Object.entries(lists);
    Object.entries(refs.lists).forEach(([id, info]) => {
      const orig = listList.find(([,[origName]]) => origName === info.name);

      if (orig) {
        logOperation('LINK', 'list', info.name);
        idMap[id] = orig[0]; // re-use list from the origin
      } else {
        logOperation('COPY', 'list', info.name);
        const newId = genId();
        idMap[id] = newId;
        lists[newId] = info.data; // Copy list
      }
    });


    // ------------------------------------------------------------------------
    //  Copy broadcasts, if necessary
    // ------------------------------------------------------------------------
    const broadcastList = Object.entries(broadcasts);
    Object.entries(refs.broadcasts).forEach(([id, info]) => {
      const orig = broadcastList.find(([,[origName]]) => origName === info.name);

      if (orig) {
        logOperation('LINK', 'broadcast', info.name);
        idMap[id] = orig[0]; // re-use list from the origin
      } else {
        logOperation('COPY', 'broadcast', info.name);
        const newId = genId();
        idMap[id] = newId;
        broadcasts[newId] = info.name; // Copy broadcast
      }
    });

    // ------------------------------------------------------------------------
    //  Map all blocks
    // ------------------------------------------------------------------------
    refs.blocks.forEach(({ id }) => {
      idMap[id] = genId();
    });


    // ------------------------------------------------------------------------
    //  Copy all blocks
    // ------------------------------------------------------------------------
    const origBlockList = Object.entries(blocks);

    const removeBlock = (blockId) => {
      origBlockList.forEach(([subId, subBlock]) => {
        if (subBlock.parent === blockId) {
          removeBlock(subId);
        }
      });

      const block = blocks[blockId];
      if (block.comment) {
        delete comments[block.comment];
      }

      delete blocks[blockId];
    };

    refs.blocks.forEach(({ id, data: block}) => {
      if (block.topLevel && !block.shadow) {
        if (block.opcode === 'procedures_definition') {

          const proccode = sourceInfo.proccodeForBlock(id);

          //
          // Updated procedure definition from the source will have different argument ids
          // comparing to the origin.
          //
          // Perform argument re-mapping for all procedure call blocks in the origin.
          // All blocks in the source already have proper ids.
          // 
          const argumentIdsStr = sourceBlocks[block.inputs.custom_block[1]].mutation.argumentids;
          const argumentIds = JSON.parse(argumentIdsStr);

          origBlockList
          .filter(([,callBlock]) => callBlock.opcode === 'procedures_call' && callBlock.mutation.proccode === proccode)
          .forEach(([,callBlock]) => {
            const origToSource = {};
            const origArgumentIds = JSON.parse(callBlock.mutation.argumentids);
            origArgumentIds.forEach((i, index) => {
              origToSource[i] = argumentIds[index];
            });

            callBlock.mutation.argumentids = argumentIdsStr;
            callBlock.inputs = Object.fromEntries(
              Object.entries(callBlock.inputs).map(([k, v]) => [origToSource[k], v])
            );
            // logOperation('FIX', 'proc call', proccode);
          });


          const origDefId = origInfo.blockForProccode(proccode);

          if (origDefId) {
            const origDef = blocks[origDefId];

            // Copy some data from the original definition
            block.x = origDef.x;
            block.y = origDef.y;

            // Remove original
            logOperation('DELETE', 'procedure', proccode);
            removeBlock(origDefId);
          }
          logOperation('COPY', 'procedure', proccode);          
        } else {
          const stackName = sourceInfo.stacks().find((x) => x.id === id).name;
          const origStackId = origInfo.stacks().find((x) => x.name === stackName)?.id;

          if (origStackId) {
            const origStack = blocks[origStackId];

            // Copy some data from the original definition
            block.x = origStack.x;
            block.y = origStack.y;

            // Remove original
            logOperation('DELETE', 'stack', stackName);
            removeBlock(origStackId);
          }
          logOperation('COPY', 'stack', stackName);                  
        }
      }

      if (block.next) {
        block.next = idMap[block.next];
      }
      if (block.parent) {
        block.parent = idMap[block.parent];
      }
      if (block.fields.VARIABLE) {
        block.fields.VARIABLE[1] = idMap[block.fields.VARIABLE[1]];
      }
      if (block.fields.LIST) {
        block.fields.LIST[1] = idMap[block.fields.LIST[1]];
      }
      if (block.fields.BROADCAST_OPTION) {
        block.fields.BROADCAST_OPTION[1] = idMap[block.fields.BROADCAST_OPTION[1]];
      }

      // Handle Inputs
      Object.values(block.inputs).forEach((input) => {
        const [, data] = input; 
        if (Array.isArray(data)) {
          const [type, , id] = data;
          switch (type) {
            case 11: 
            case 12:
            case 13: 
              data[2] = idMap[id];
              break;
          }
        } else {
          input[1] = idMap[data];
        }
      });

      // Copy block
      const newId = idMap[id];
      blocks[newId] = block;

      // Handle block comment
      if (block.comment) {
        const comment = sourceComments[block.comment];
        const newCommentId = genId();
        block.comment = newCommentId;
        comment.blockId = newId;
        comments[newCommentId] = comment; 
      }
    });

    // ------------------------------------------------------------------------
    //  Calculate absolute coordinates of ALL output comments 
    // ------------------------------------------------------------------------
    Object.values(comments).forEach((comment) => {
      if (comment.relative) {
        const rootBlock = stackRootBlock(blocks, blocks[comment.blockId]);
        comment.x += rootBlock.x;
        comment.y += rootBlock.y;
        delete comment.relative;
      }
    });

    console.log('');
    console.log([
      gray('Save output --> '),
      bold(output)
    ].join(' '));
    console.log('');

    return project;
  });
}