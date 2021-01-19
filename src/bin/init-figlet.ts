import figlet from 'figlet';
import chalk from 'chalk';

const initFiglet = (text: string): void => {
  const bannerSmartWeave = figlet.textSync(text, {
    horizontalLayout: 'universal smushing',
  });
  console.log(chalk.white(bannerSmartWeave));
  return;
};

export default initFiglet;
