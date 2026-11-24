import {escapeHtml as esc,formatDate} from './blog-format.mjs';
const target=document.querySelector('[data-blog-feed]');
async function loadFeed(){
  if(!target)return;
  try{
    const response=await fetch('/api/blog/posts',{cache:'no-store'});if(!response.ok)throw new Error();const data=await response.json();
    if(!data.posts.length){target.className='blog-empty';target.innerHTML='<h3>Das erste Kapitel folgt.</h3><p>Hier erscheinen bald persönliche Einblicke und Neuigkeiten von Lennox Publishing.</p>';return;}
    target.className='blog-grid';
    target.innerHTML=data.posts.slice(0,3).map(post=>`<article class="blog-card">${post.coverImageId?`<a href="/blog/${esc(post.slug)}" tabindex="-1" aria-hidden="true"><img src="/api/blog/images/${esc(post.coverImageId)}" alt="" loading="lazy" width="720" height="450"></a>`:'<div class="blog-card-placeholder" aria-hidden="true">Lennox<br><em>Journal.</em></div>'}<div class="blog-card-copy"><time datetime="${new Date(post.publishedAt).toISOString()}">${formatDate(post.publishedAt)}</time><h3><a href="/blog/${esc(post.slug)}">${esc(post.title)}</a></h3><p>${esc(post.excerpt||'Ein neuer Einblick in die Welt von Lennox Publishing.')}</p><a class="text-link" href="/blog/${esc(post.slug)}">Beitrag lesen</a></div></article>`).join('');
  }catch{target.className='blog-empty error';target.innerHTML='<h3>Der Blog ist gerade nicht erreichbar.</h3><p>Bitte versuche es später noch einmal.</p>';const retry=document.createElement('button');retry.type='button';retry.className='small-button';retry.textContent='Erneut versuchen';retry.addEventListener('click',loadFeed);target.append(retry);}
}
loadFeed();
