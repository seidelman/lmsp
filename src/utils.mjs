import chalk from 'chalk';

const { bold, gray, red, yellow } = chalk;

export function logError(message, err) {
  if (err) {
    console.log(`${red('ERROR:')} ${message}: ${err.message}`);
  } else {
    console.log(`${red('ERROR:')} ${message}`);
  }
} 

export function fatal(cond, ...args) {
  if (!cond) {
    logError(...args);
    process.exit(1); // eslint-disable-line no-process-exit
  }
}

export function stackTitle(stack) {
  const parts = [yellow(`[${stack.index}]`)];

  if (stack.isProc) {
    parts.push(gray('procedure'));
  } else {
    parts.push(gray('stack'));
  }

  if (stack.name) {
    parts.push(bold(stack.name));
  } else {
    parts.push(gray('with no name'));
  }

  return parts.join(' ');
} 


