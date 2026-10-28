const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,file)=>'<style>\n'+fs.readFileSync(path.join(root,file),'utf8')+'\n</style>');
html=html.replace(/<script src="([^"]+)" defer><\/script>/g,(_,file)=>'<script>\n'+fs.readFileSync(path.join(root,file),'utf8')+'\n</script>');
html=html.replace(/<img([^>]+)src="([^">]+\.(?:webp|png))"/g,(match,before,file)=>{
  const fp=path.join(root,file);
  const type=path.extname(file).slice(1);
  return fs.existsSync(fp)?`<img${before}src="data:image/${type};base64,${fs.readFileSync(fp).toString('base64')}"`:match;
});
fs.writeFileSync(path.join(root,'ShiftPlanner-Standalone.html'),html);
console.log('Standalone updated.');
