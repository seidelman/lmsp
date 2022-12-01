import JSZip from 'jszip';
import { writeFile, readFile, rename } from 'fs/promises';
import { existsSync } from 'fs';

// https://www.en.scratch-wiki.info/wiki/Scratch_File_Format

export async function loadProject(fileName) {
  let projectContent;

  if (fileName.endsWith('.json')) {
    projectContent = await readFile(fileName, 'utf-8');
  } else {
    const content = await readFile(fileName);
    const zip = await JSZip.loadAsync(content);
    const scratchZip = await JSZip.loadAsync(
      await zip.file('scratch.sb3').async('arraybuffer')
    );
    projectContent = await scratchZip.file('project.json').async('string');
  }

  return JSON.parse(projectContent);
}

export async function loadSvg(fileName) {
  const content = await readFile(fileName);
  const zip = await JSZip.loadAsync(content);
  return await zip.file('icon.svg').async('string');
}


export async function updateProject(target, output, updater) {
  const content = await readFile(target);
  const zip = await JSZip.loadAsync(content);
  const scratchZip = await JSZip.loadAsync(
    await zip.file('scratch.sb3').async('arraybuffer')
  );
  const origJson = await scratchZip.file('project.json').async('string');
  const updated = await updater(JSON.parse(origJson));

  if (updated) {
    if (existsSync(output)) {
      await rename(output, `${output}.bak`);
    }

    if (output.endsWith('.json')) {
      await writeFile(output, JSON.stringify(updated, null, 2), 'utf-8');
    } else {
      await scratchZip.file('project.json', JSON.stringify(updated));
      const scratchZipContent = await scratchZip.generateAsync({ type: 'nodebuffer'});
      zip.file('scratch.sb3', scratchZipContent);
      await writeFile(output, await zip.generateAsync({ type: 'nodebuffer'}));
    }
  }
}

export function projectInfo(project) {
  const { blocks, comments } = project.targets[1];

  const blockByProccode = {};
  const proccodeByBlock = {};

  const procedures = [];  // List of all procedures
  const stacks = [];      // List of all stacks, including procedures

  Object.entries(blocks).forEach(([blockId, block]) => {
    if (block.opcode === 'procedures_prototype') {
      const id = block.parent;
      const { proccode } = block.mutation;

      blockByProccode[proccode] = id;
      proccodeByBlock[id] = proccode;

      const rec = { 
        id,
        index: stacks.length + 1,
        name: proccode,
        isProc: true,
      };

      procedures.push(rec);
      stacks.push(rec);

    } else if (block.topLevel && !block.shadow && block.opcode !== 'procedures_definition') {
      let name = '';

      if (block.comment) {
        const re = /{([^{}]*)/;
        const match = re.exec(comments[block.comment].text);
        if (match) {
          name = match[1];
        }
      }
      stacks.push({ 
        id: blockId,
        index: stacks.length + 1,
        name,
        isProc: false,
      });
    }
  })

  return {
    blockForProccode(proccode) {
      return blockByProccode[proccode];
    },

    proccodeForBlock(blockId) {
      return proccodeByBlock[blockId];
    },

    stacksByName(name) {
      const exactMatch = stacks.filter((b) => b.name === name);
      if (exactMatch.length > 0) {
        return exactMatch;
      }
      return stacks.filter((b) => b.name.startsWith(name));
    },

    procedures() {
      return procedures;
    },

    stacks() {
      return stacks;
    }
  }
}
