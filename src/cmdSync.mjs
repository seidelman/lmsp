import { projectInfo } from './projectFile.mjs';
import { fatal } from './utils.mjs';

import copyProject from './copyProject.mjs';

export default async function handleSyncCommand(source, target, output) {
  await copyProject(source, target, output, (sourceProject, targetProject) => {
    const sourceInfo = projectInfo(sourceProject);
    const targetInfo = projectInfo(targetProject);
    const stackToCopy = [];

    for (const proc of sourceInfo.procedures()) {
      const targets = targetInfo.procedures().filter((x) => x.name === proc.name);

      if (targets.length > 1) {
        fatal(false, `Ambiguous procedure [${proc.name}]. Multiple choices.`);
      }
      if (targets.length === 1) {
        stackToCopy.push(proc);
      }
    }

    for (const stack of sourceInfo.stacks()) {
      if (stack.isProc || !stack.name) {
        continue; // Ignore procedures and unnamed stacks
      }

      const targets = targetInfo.stacks().filter((x) => x.name === stack.name);

      if (targets.length > 1) {
        fatal(false, `Ambiguous stack [${stack.name}]. Multiple choices.`);
      }
      if (targets.length === 1) {
        stackToCopy.push(stack);
      }
    }

    return stackToCopy;
  });
}