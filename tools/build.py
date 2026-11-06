# junta o template com o app.js e gera laringe.html
import os
d=os.path.dirname(os.path.abspath(__file__))
t=open(os.path.join(d,'laringe.template.html')).read()
s=open(os.path.join(d,'app.js')).read()
open(os.path.join(d,'..','laringe.html'),'w').write(t.replace('/*APP*/',s))
print('laringe.html ok')
