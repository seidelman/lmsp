// ============================================================================
//  Create a project reference tracer object.
//
//  This object is used to track references by the part of the project.
// ============================================================================

export default function referenceTracer(project, { followProcedures = false } = {}) {
  const { broadcasts } = project.targets[0];
  const { blocks, variables, lists } = project.targets[1];
  const blockList = Object.entries(blocks);

  const usage = {
    broadcasts: {},
    variables: {},
    lists: {},
    procedures: {},
    blocks: [],
  };

  const addVariableUsage = (id) => {
    if (!id) return;

    const info = usage.variables[id];
    if (info) {
      info.count++;
    } else {
      usage.variables[id] = {
        type: 'variable',
        id,
        name: variables[id][0],
        data: variables[id],
        count: 1,
      };
    }
  };

  const addListUsage = (id) => {
    if (!id) return;

    const info = usage.lists[id];
    if (info) {
      info.count++;
    } else {
      usage.lists[id] = {
        type: 'list',
        id,
        name: lists[id][0],
        data: lists[id],
        count: 1,
      };
    }
  };

  const addBroadcastUsage = (id) => {
    if (!id) return;

    const info = usage.broadcasts[id];
    if (info) {
      info.count++;
    } else {
      usage.broadcasts[id] = {
        type: 'broadcast',
        id,
        name: broadcasts[id],
        count: 1,
      };
    }
  };


  const addProcedureUsage = (proccode) => {
    const info = usage.procedures[proccode];

    if (info) {
      info.count++;
    } else {
      const proc = blockList.find(
        ([, pb]) => (
          pb.opcode === 'procedures_definition' && 
          blocks[pb.inputs.custom_block[1]].mutation.proccode === proccode
        )
      );

      // TODO: check for consistency

      const [procBlockId] = proc;
      usage.procedures[proccode] = {
        type: 'procedure',
        id: procBlockId,
        name: proccode,
        count: 1,
      };

      if (followProcedures) {
        checkUsage(procBlockId);
      }
    }
  };


  const checkUsage = (blockId) => {
    if (usage.blocks.find((x) => x.id === blockId)) return;
    
    const block = blocks[blockId];
    usage.blocks.push({
      id: blockId,
      data: block,
    });

    // console.log(JSON.stringify(block, null, 2));

    addVariableUsage(block.fields.VARIABLE?.[1]);
    addListUsage(block.fields.LIST?.[1]);
    addBroadcastUsage(block.fields.BROADCAST_OPTION?.[1]);

    // Handle Inputs
    Object.values(block.inputs).forEach(([, data]) => {
      if (Array.isArray(data)) {
        const [type, , id] = data;
        switch (type) {
          case 11: 
            addBroadcastUsage(id);
            break;

          case 12:
            addVariableUsage(id);
            break;

          case 13: 
            addListUsage(id);
            break;
        }
      }
    });

    if (block.opcode === 'procedures_call' ) {
      addProcedureUsage(block.mutation.proccode);
    }

    if (block.opcode === 'procedures_definition' && followProcedures ) {
      addProcedureUsage(blocks[block.inputs.custom_block[1]].mutation.proccode);
    }

    blockList.forEach(([subId, subBlock])=> {
      if (subBlock.parent === blockId) {
        checkUsage(subId);
      }
    }); 
  }

  return {
    add(blockId){
      checkUsage(blockId);
      return this;
    },

    usage() { 
      return usage; 
    },

    list() {
      return [
        ...Object.values(usage.procedures),
        ...Object.values(usage.broadcasts),
        ...Object.values(usage.variables),
        ...Object.values(usage.lists),
      ]
    },
  };
}