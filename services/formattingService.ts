import { format } from 'prettier';
import parserHtml from 'prettier/plugins/html';
import parserPostcss from 'prettier/plugins/postcss';
import parserBabel from 'prettier/plugins/babel';
import parserEstree from 'prettier/plugins/estree';

export const formatCode = async (code: string, language: 'html' | 'css' | 'javascript'): Promise<string> => {
  try {
    let options: any = {
      parser: 'html',
      plugins: [parserHtml],
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      singleQuote: true,
      bracketSameLine: true,
    };

    if (language === 'css') {
      options.parser = 'css';
      options.plugins = [parserPostcss];
    } else if (language === 'javascript') {
      options.parser = 'babel';
      options.plugins = [parserBabel, parserEstree];
      options.semi = true;
      options.trailingComma = 'es5';
    }

    return await format(code, options);
  } catch (error) {
    console.error('Format Error:', error);
    // Return original code if formatting fails (e.g. syntax error)
    return code; 
  }
};