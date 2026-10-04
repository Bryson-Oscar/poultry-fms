const fs = require('fs');
const path = require('path');

function walk(d) {
  fs.readdirSync(d).forEach(f => {
    let p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      let c = fs.readFileSync(p, 'utf8');
      let o = c;
      
      // Remove backdrop-blur-* classes
      c = c.replace(/backdrop-blur-[a-z0-9]+/g, '');
      
      // Replace bg-slate-900/90, 95, 80 with standard bg-card
      c = c.replace(/bg-slate-900\/(90|95|80)/g, 'bg-card');
      
      // bg-slate-900/80 etc inside string interpolations
      c = c.replace(/bg-slate-900\/80/g, 'bg-card');
      c = c.replace(/bg-slate-950\/80/g, 'bg-background');
      c = c.replace(/bg-black\/60/g, 'bg-background/80');
      c = c.replace(/bg-card\/50/g, 'bg-card');
      c = c.replace(/bg-slate-950\/75/g, 'bg-background/90');

      if (c !== o) {
        fs.writeFileSync(p, c);
        console.log('Updated', p);
      }
    }
  });
}

walk('./src');
