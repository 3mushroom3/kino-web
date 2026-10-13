# Собирает одностраничную версию для публикации: CSS и JS встраиваются в страницу, постеры остаются файлами.
import glob, shutil, os
os.makedirs('artifact/posters', exist_ok=True)
css = open(glob.glob('dist/assets/*.css')[0]).read()
js = open(glob.glob('dist/assets/*.js')[0]).read()
assert '</script' not in js.lower()
page = f'''<title>Что сегодня посмотреть</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>{css}</style>
<div id="root"></div>
<script type="module">{js}</script>
'''
open('artifact/index.html', 'w').write(page)
for f in glob.glob('dist/posters/*.jpg'): shutil.copy(f, 'artifact/posters/')
print(len(page))
