#!/usr/bin/env node

/* eslint-disable node/shebang */

import { existsSync } from 'node:fs';

import chalk from 'chalk';

import { fatal } from './src/utils.mjs';
import cmdList from './src/cmdList.mjs';
import cmdCopy from './src/cmdCopy.mjs';
import cmdSync from './src/cmdSync.mjs';

import { loadProject, loadSvg } from './src/projectFile.mjs';

const { bold, cyan, yellow } = chalk;

const shortHelp = `
${bold('NAME')}  
    ${bold('lmsp')} - manipulate LEGO Education EV3 Classroom (LMSP) files.

${bold('SYNOPSIS')}
    ${bold('lsmp list')} file
    ${bold('lsmp json')} file
    ${bold('lsmp svg')}  file
    ${bold('lsmp copy')} source target output stack-id ...
    ${bold('lsmp sync')} source target output
`;

// ============================================================================
//                      Print Help end exit with error
// ============================================================================
function help(message) {
  fatal(!message, `${message}\n${shortHelp}`);

  console.log(`${shortHelp}  

${bold('DESCRIPTION')}  
    EV3 Classroom application does not allow block copying between projects. This makes it difficult to maintain 
    a library of common My Blocks and share it among several projects - a common development pattern in competitive FLL 
    setup.

    The following commands can be used to extract information from an LMSP ${yellow('file')}:

    - ${bold('list')}    List top level stacks. Used to identify target for copy
    - ${bold('json')}    Extract JSON project into standard output 
    - ${bold('lsmp')}    Extract SVG file into standard output 

    The ${bold('copy')} and ${bold('sync')} commands take stacks from the ${yellow('source')} file and merge them with stacks in 
    the ${yellow('target')} file by either copying or replacing. All necessary variables, lists, broadcasts and procedures 
    (My Blocks) are merged as well, if used by the source stacks. The result is written to the ${yellow('output')} file.

                             ${bold(`source -> target => output`)}

    If the ${yellow('target')} file exists, it gets overwritten and the original is copied into *.bak file.

    The ${yellow('target')} is always an LSMP file. The ${yellow('source')} or ${yellow('output')} can be either LSMP or JSON files in any combination.

    The ${bold('copy')} command copies the stacks identified by one or more stack IDs, which may be one of
    the following:

    - Numeric stack index, as reported by the list command
    - Full or partial (prefix) stack name, as reported by the list command

        For procedure definition (My Block) stacks, the name is procedure ${bold('proccode')} string, which is a combination of
        My block names, %s parameters placeholders and intermediate labels.

        For other stacks, the name is determined by a text of the comment attached to the top element of the stack.
        The name should be in curly brackets ${bold(`{name}`)} somewhere in the text.

    The ${bold('sync')} command copies ALL the stacks from the source that have stacks with the same name in the
    target.

${bold('REFERENCES')}

    ${cyan(`https://education.lego.com/en-us/downloads/mindstorms-ev3/software`)}
    ${cyan(`https://fileinfo.com/extension/lmsp`)}
    ${cyan(`https://www.en.scratch-wiki.info/wiki/Scratch_File_Format`)}

`);

  process.exit(1); // eslint-disable-line no-process-exit
}


// ============================================================================
//                      Program entry point
// ============================================================================

const options = process.argv.slice(2);

if (options.length === 0) {
  help();
}

const cmd = options[0];

function parameter({ name, value, lmsp, json, exists }) {
  return () => {
    if (!value) {
      help(`Parameter ${bold(name)} must be specified.`);
    }
    if (lmsp && !value.endsWith('.lmsp')) {
      help(`Invalid value ${bold(value)} for parameter ${bold(name)}. The file must be *.lmsp`);
    }
    if (json && !value.endsWith('.lmsp') && !value.endsWith('.json')) {
      help(`Invalid value ${bold(value)} for parameter ${bold(name)}. The file must be either *.lmsp or *.json`);
    }
    if (exists &&!existsSync(value)) {
      help(`Invalid value ${bold(value)} for parameter ${bold(name)}. The file does not exists.`);
    }
    return value;
  };
}

const file = parameter({
  name: 'file', 
  value: options[1],
  lsmp: true,
  exists: true,
});

const source = parameter({
  name: 'source', 
  value: options[1],
  json: true,
  exists: true,
});

const target = parameter({
  name: 'target', 
  value: options[2],
  lsmp: true,
  exists: true,
});

const output = parameter({
  name: 'output', 
  value: options[3],
  json: true,
});

switch (cmd) {
  case 'list': 
    cmdList(file());
    break;

  case 'json': {
    const project = await loadProject(file());
    console.log(JSON.stringify(project, null, 2));
    break;
  }

  case 'svg': {
    const svg = await loadSvg(file());
    console.log(svg);
    break;
  }

  case 'copy':
    if (options.length < 5) {
      help(`At least one ${bold('stack-id')} must be specified.`);
    }
    await cmdCopy(source(), target(), output(), options.slice(4));
    break;

  case 'sync':
    await cmdSync(source(), target(), output())
    break;

  case 'merge':
    help(`Command ${bold(cmd)} is not implemented yet`);
    break;

  case 'help':
    help();
    break;

  default:
    help(`Command ${bold(cmd)} is invalid`);
    break;
}
