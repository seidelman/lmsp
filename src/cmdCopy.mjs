import { projectInfo } from './projectFile.mjs';
import { fatal, stackTitle } from './utils.mjs';

import copyProject from './copyProject.mjs';

export default async function handleCopyCommand(source, target, output, stackNames) {
  await copyProject(source, target, output, (sourceProject) => {
    const info = projectInfo(sourceProject);
    const stackToCopy = [];

    for (const name of stackNames) {
      const index = Number(name);

      if (Number.isInteger(index)) {
        const stack = info.stacks().find((stack) => stack.index === index);
        fatal(stack, `Unknown stack index [${name}]. Use "list" command to get available indexes`);
        stackToCopy.push(stack);
      } else {
        const list = info.stacksByName(name);

        if (list.length > 1) {
          const candidates = list.forEach((stack) => `    ${stackTitle(stack)}\n`);
          fatal(false, `Ambiguous stack name [${name}]. Candidates are: \n\n${candidates}`);
        }
        if (list.length === 0) {
          fatal(false, `Invalid stack name [${name}]. Not found`);
        }
        stackToCopy.push(...list);
      }
    }

    return stackToCopy;
  });
}