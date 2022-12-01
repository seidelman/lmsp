import chalk from 'chalk';

import referenceTracer from './referenceTracer.mjs';
import { loadProject, projectInfo } from './projectFile.mjs';
import { stackTitle } from './utils.mjs';


const { bold, gray, red, yellow } = chalk;

function line() {
  console.log('');
  console.log(gray(''.padEnd(80, '-')));
  console.log('');  
}

export default async function cmdList(file) {
  console.log('');
  console.log(`Stacks in file ${yellow(file)} `);
  const project = await loadProject(file);

  const { blocks, comments } = project.targets[1]; 
  
  projectInfo(project).stacks().forEach((stack, index) => {
    if (index === 0) { line(); }

    console.log(stackTitle(stack)); 
    console.log('');

    const block = blocks[stack.id];

    for(let b = block; b; b = blocks[b.next]) {
      const parts = [`[${b.opcode}]`];

      if (b.opcode === 'procedures_call') {
        parts.push(red(`-> (${b.mutation.proccode})`));
      }

      if (b.comment) {
        parts.push(gray(`// ${comments[b.comment].text}`));
      }

      console.log(`   ${parts.join(' ')}`);
    }

    const refs = referenceTracer(project).add(stack.id).list();

    if (refs.length) {
      console.log('');
      for(const ref of refs) {
        const parts = [
          gray(`uses ${ref.type.padEnd(10, ' ')}`),
          `"${ref.name}"`,
          gray(`(${ref.count})`)
        ];
        console.log(`   ${parts.join(' ')}`);
      }
    }

    line();
  });
}