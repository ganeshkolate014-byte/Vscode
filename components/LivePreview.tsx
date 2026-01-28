import React, { useMemo } from 'react';

interface LivePreviewProps {
  html: string;
  css: string;
  js: string;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ html, css, js }) => {
  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; font-family: sans-serif; }
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>
            try {
              ${js}
            } catch (err) {
              console.error(err);
              document.body.innerHTML += '<div style="color:red; background:#ffebeb; padding:10px; border-top:1px solid red; position:fixed; bottom:0; left:0; right:0;">JS Error: ' + err.message + '</div>';
            }
          </script>
        </body>
      </html>
    `;
  }, [html, css, js]);

  return (
    <div className="w-full h-full bg-white">
      <iframe
        title="preview"
        srcDoc={srcDoc}
        className="w-full h-full border-none"
        sandbox="allow-scripts"
      />
    </div>
  );
};