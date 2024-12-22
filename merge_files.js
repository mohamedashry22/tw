import fs from 'fs';
import path from 'path';

// Function to recursively find all .js files in a folder
const getJavaScriptFiles = (folderPath) => {
  let jsFiles = [];
  const items = fs.readdirSync(folderPath);

  items.forEach(item => {
    const itemPath = path.join(folderPath, item);
    const stats = fs.statSync(itemPath);

    if (
      stats.isDirectory() &&
      item !== '__tests__' &&
      item !== 'node_modules' // Exclude __tests__ and node_modules
    ) {
      // Recurse into subdirectories
      jsFiles = jsFiles.concat(getJavaScriptFiles(itemPath));
    } else if (stats.isFile() && path.extname(item) === '.js') {
      jsFiles.push(itemPath);
    }
  });

  return jsFiles;
};

// Function to merge all .js files into one
const mergeJavaScriptFiles = (folderPath, outputFile) => {
  try {
    // Get all .js files from the folder and subfolders
    const jsFiles = getJavaScriptFiles(folderPath);

    // Initialize the output content
    let combinedContent = '';

    // Loop through each JavaScript file
    jsFiles.forEach(file => {
      const fileContent = fs.readFileSync(file, 'utf-8');

      // Add comment with file name
      combinedContent += `// File: ${path.relative(folderPath, file)}\n`;
      combinedContent += `${fileContent}\n\n`;
    });

    // Write combined content to the output file
    fs.writeFileSync(outputFile, combinedContent, 'utf-8');

    console.log(`Successfully merged ${jsFiles.length} files into ${outputFile}`);
  } catch (error) {
    console.error('Error merging files:', error);
  }
};

// Specify the folder and output file
const folderPath = '.'; // Change this to your folder path or keep it as '.' for current directory
const outputFile = './combined.js'; // Change this to your desired output file

mergeJavaScriptFiles(folderPath, outputFile);
