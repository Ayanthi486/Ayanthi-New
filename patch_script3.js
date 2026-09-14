const fs = require('fs');
let file = fs.readFileSync('apps/web/src/lib/utils.ts', 'utf8');

file = file.replace(
`      if (existingWindow) {
        existingWindow.document.open();
        existingWindow.document.write(html);
        existingWindow.document.close();
      } else {
        const w = window.open('', '_blank');
        if (w) {
          w.document.open();
          w.document.write(html);
          w.document.close();
        }
      }`,
`      const htmlBlob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(htmlBlob);
      if (existingWindow) {
        existingWindow.location.href = url;
      } else {
        window.open(url, '_blank');
      }`
);

fs.writeFileSync('apps/web/src/lib/utils.ts', file);
