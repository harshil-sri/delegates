import { benchMarkup, judges } from './judges.mjs';

const stage = document.querySelector('#bench-stage');
const scene = document.querySelector('#court-scene');
scene.innerHTML = `<img class="scene-background" src="/art/chamber.svg" alt="" width="1440" height="1000">${benchMarkup()}`;
document.querySelector('#bench-cards').innerHTML = judges.map(judge => `<article><span class="eyebrow">${judge.perspective.toUpperCase()}</span><h2>${judge.name}</h2><p>${judge.blurb}</p></article>`).join('');
const figures = () => [...scene.querySelectorAll('.judge')];
const setAll = state => figures().forEach(figure => figure.setAttribute('class', `judge ${state}`));
const replay = event => { stage.dataset.event = ''; void stage.offsetWidth; stage.dataset.event = event; };
setAll('is-listening');
document.querySelectorAll('[data-speaker]').forEach(button => button.addEventListener('click', () => {
  scene.dataset.speaker = button.dataset.speaker; stage.dataset.speaker = button.dataset.speaker;
  setAll(button.dataset.speaker === 'panel' ? 'is-speaking' : 'is-listening'); replay('statement');
}));
document.querySelectorAll('[data-state]').forEach(button => button.addEventListener('click', () => setAll(button.dataset.state)));
document.querySelector('[data-verdict]').addEventListener('click', () => {
  setAll('is-assessing');
  ['is-narrowing', 'is-accepting', 'is-rejecting'].forEach((state, index) => setTimeout(() => figures()[index].setAttribute('class', `judge ${state}`), 900 + index * 500));
});
document.querySelectorAll('[data-event]').forEach(button => button.addEventListener('click', () => { setAll(button.dataset.event === 'ruling' ? 'is-speaking' : 'is-listening'); replay(button.dataset.event); }));

// ?solo=arata|vale|thorne frames one judge for close-up review and video beats.
const solo = new URLSearchParams(location.search).get('solo');
const pick = judges.find(judge => judge.id === solo);
if (pick) {
  const svg = scene.querySelector('.bench-svg');
  svg.setAttribute('viewBox', `${pick.x - 150} 60 300 420`);
  svg.classList.add('is-solo');
  stage.classList.add('is-solo');
}
