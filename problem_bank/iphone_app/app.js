(() => {
  'use strict';
  const app = document.querySelector('#app');
  const STORE = 'vetOncologyQuizStateV1';
  const BANK = 'vetOncologyQuizBankV1';
  let questions = [];
  let state = JSON.parse(localStorage.getItem(STORE) || '{"saved":[],"wrong":[],"attempts":0,"correct":0}');
  let session = null;

  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const save = () => localStorage.setItem(STORE, JSON.stringify(state));
  const difficulty = d => ({basic:'基本',standard:'標準',hard:'難問'}[d] || d);
  const format = f => ({single_best_answer:'5択',multiple_select:'多肢選択',case:'症例',true_false:'正誤',matching:'マッチング'}[f] || f);
  const unique = a => [...new Map(a.map(q => [q.duplicate_key, q])).values()];
  const shuffled = a => [...a].sort(() => Math.random() - .5);
  const byId = id => questions.find(q => q.id === id);
  const homeButton = () => '<button class="plain" data-action="go-home">‹ 学習メニュー</button>';

  async function load() {
    try {
      const cached = localStorage.getItem(BANK);
      if (cached) questions = JSON.parse(cached);
      const response = await fetch('../questions.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('問題データを読み込めません。');
      questions = await response.json();
      localStorage.setItem(BANK, JSON.stringify(questions));
    } catch (e) {
      if (!questions.length) {
        app.innerHTML = '<div class="empty"><h2>初回の準備が必要です</h2><p>問題データを読み込めませんでした。最初だけインターネットに接続して、このアプリを開いてください。</p><p class="notice">Web公開時は、<code>iphone_app</code> と親フォルダの <code>questions.json</code> を同じ構成で配置してください。</p></div>';
        return;
      }
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    renderHome();
  }

  function setRoute(route) {
    document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.route === route));
  }
  function header(title, sub='') { return '<div class="topline"><div><p class="eyebrow">獣医腫瘍学認定医試験</p><h1>'+esc(title)+'</h1>'+(sub?'<p class="muted">'+esc(sub)+'</p>':'')+'</div><span class="pill">'+questions.length+'問</span></div>'; }

  function renderHome() {
    session = null; setRoute('home');
    const rate = state.attempts ? Math.round(state.correct / state.attempts * 100) : 0;
    app.innerHTML = header('今日の学習','教科書根拠つき・個人用問題集')+
      '<section class="card hero"><p class="muted">今日の目標</p><div class="big-number">10 問</div><button class="button primary" data-action="quick">ランダム10問を始める</button></section>'+
      '<div class="grid"><button class="card secondary" data-action="open-practice">分野を選んで学習</button><button class="card secondary" data-action="open-review">間違いを復習 '+state.wrong.length+'問</button><button class="card secondary" data-action="open-mock">模擬試験を作る</button></div>'+
      '<h2 class="section-title">学習記録</h2><section class="card"><div class="grid3"><div><b>'+state.attempts+'</b><br><small>解答数</small></div><div><b>'+rate+'%</b><br><small>正答率</small></div><div><b>'+state.saved.length+'</b><br><small>あとで復習</small></div></section>'+
      '<p class="muted" style="font-size:13px">解答履歴と復習リストはこのiPhone内に保存されます。</p>';
  }

  function renderPractice() {
    session = null; setRoute('practice');
    const domains = [...new Set(questions.flatMap(q => q.domain))].sort();
    app.innerHTML = header('問題を選ぶ','分野・難易度を指定して出題')+
      '<section class="card"><label class="form-label">分野</label><select id="domain"><option value="">すべての分野</option>'+domains.map(d=>'<option>'+esc(d)+'</option>').join('')+'</select>'+
      '<label class="form-label">難易度</label><select id="level"><option value="">すべて</option><option value="basic">基本</option><option value="standard">標準</option><option value="hard">難問</option></select>'+
      '<label class="form-label">出題数</label><select id="count"><option value="10">10問</option><option value="30">30問</option><option value="50">50問</option></select>'+
      '<button class="button primary" data-action="start-filter">学習を始める</button></section>';
  }

  function renderMock() {
    session = null; setRoute('practice');
    app.innerHTML = header('模擬試験','基本40%・標準40%・難問20%')+
      '<section class="card"><p>解答後にすぐ解説を読む形式です。終了時に結果を確認できます。</p><div class="grid">'+[30,50,100].map(n=>'<button class="secondary" data-mock="'+n+'">'+n+'問模試</button>').join('')+'</div></section>'+homeButton();
  }

  function buildMock(n) {
    const plan = {basic:Math.round(n*.4), standard:Math.round(n*.4), hard:n-Math.round(n*.4)-Math.round(n*.2)};
    const picked = [];
    Object.entries(plan).forEach(([level,count]) => picked.push(...shuffled(unique(questions.filter(q => q.difficulty===level && q.status==='verified'))).slice(0,count)));
    return shuffled(unique(picked)).slice(0,n);
  }

  function start(ids, title) {
    if (!ids.length) return;
    session = {ids, index:0, title, answered:false, selected:[], score:0};
    renderQuestion();
  }
  function renderQuestion() {
    const q = byId(session.ids[session.index]);
    const isMulti = q.format === 'multiple_select';
    const progress = Math.round(session.index / session.ids.length * 100);
    app.innerHTML = '<div class="question-top"><button class="plain" data-action="quit">× 終了</button><span>'+ (session.index+1)+' / '+session.ids.length+'</span></div><div class="progress"><i style="width:'+progress+'%"></i></div>'+
      '<div class="meta"><span class="tag">'+esc(format(q.format))+'</span><span class="tag">'+esc(difficulty(q.difficulty))+'</span>'+q.domain.map(d=>'<span class="tag">'+esc(d)+'</span>').join('')+'</div>'+
      '<p class="question">'+esc(q.question)+'</p>'+(isMulti?'<p class="muted">該当するものをすべて選んでください。</p>':'')+
      '<div id="choices">'+q.choices.map(c=>'<button class="choice" data-choice="'+c.label+'"><span class="label">'+c.label+'</span><span>'+esc(c.text)+'</span></button>').join('')+'</div>'+
      '<div class="question-actions"><button class="plain" data-action="toggle-save">'+(state.saved.includes(q.id)?'★ 復習リストから外す':'☆ あとで復習')+'</button><button class="primary" data-action="check" disabled>解答する</button></div>';
  }
  function choose(label) {
    if (session.answered) return;
    const q = byId(session.ids[session.index]);
    if (q.format === 'multiple_select') session.selected = session.selected.includes(label) ? session.selected.filter(x=>x!==label) : [...session.selected,label]; else session.selected=[label];
    document.querySelectorAll('[data-choice]').forEach(b => b.classList.toggle('selected',session.selected.includes(b.dataset.choice)));
    document.querySelector('[data-action="check"]').disabled = !session.selected.length;
  }
  function check() {
    const q = byId(session.ids[session.index]);
    if (!session.selected.length || session.answered) return;
    session.answered = true;
    const correct = q.correct_answers.length===session.selected.length && q.correct_answers.every(x=>session.selected.includes(x));
    state.attempts++; if(correct){state.correct++; session.score++;} else if(!state.wrong.includes(q.id)) state.wrong.push(q.id); save();
    document.querySelectorAll('[data-choice]').forEach(b => { const l=b.dataset.choice; if(q.correct_answers.includes(l)) b.classList.add('correct'); else if(session.selected.includes(l)) b.classList.add('incorrect'); b.disabled=true; });
    const answer = '<section class="answer-box '+(correct?'':'wrong')+'"><b>'+(correct?'正解です':'不正解です')+'</b><p>正答：'+q.correct_answers.join('・')+'</p><p>'+esc(q.rationale)+'</p><details><summary>選択肢ごとの解説</summary>'+q.choices.map(c=>'<p><b>'+c.label+'：</b>'+esc(q.choice_rationales[c.label]||'')+'</p>').join('')+'</details><div class="source">根拠：'+q.sources.map(s=>esc(s.chapter)+' p.'+s.printed_page+(s.note?'（'+esc(s.note)+'）':'')).join(' ／ ')+'</div></section>';
    document.querySelector('.question-actions').insertAdjacentHTML('afterend',answer+'<button class="button primary" data-action="next">'+(session.index+1===session.ids.length?'結果を見る':'次の問題へ')+'</button>');
    document.querySelector('[data-action="check"]').disabled=true;
  }
  function next() { if (++session.index >= session.ids.length) renderResult(); else { session.answered=false;session.selected=[];renderQuestion(); } }
  function renderResult() { const rate=Math.round(session.score/session.ids.length*100); app.innerHTML=header(session.title,'結果')+'<section class="card"><p class="score">'+session.score+' / '+session.ids.length+' 問正解（'+rate+'%）</p><p>不正解の問題は「復習」から繰り返し確認できます。</p><button class="button primary" data-action="review-wrong">不正解を復習する</button></section>'+homeButton(); }

  function renderReview() {
    session=null;setRoute('review'); const saved=state.saved.map(byId).filter(Boolean), wrong=state.wrong.map(byId).filter(Boolean);
    app.innerHTML=header('復習','端末に保存した問題')+'<section class="card"><div class="row"><div><h3>間違えた問題</h3><span class="muted">'+wrong.length+'問</span></div><button class="secondary" data-action="start-wrong" '+(!wrong.length?'disabled':'')+'>復習する</button></div><div class="divider"></div><div class="row"><div><h3>あとで復習</h3><span class="muted">'+saved.length+'問</span></div><button class="secondary" data-action="start-saved" '+(!saved.length?'disabled':'')+'>学習する</button></div></section><button class="danger" data-action="clear-history">解答記録をリセット</button>';
  }
  function renderStats() {session=null;setRoute('stats'); const rate=state.attempts?Math.round(state.correct/state.attempts*100):0; app.innerHTML=header('学習記録','この端末での記録')+'<section class="card"><div class="grid3"><div><b>'+state.attempts+'</b><br><small>解答数</small></div><div><b>'+state.correct+'</b><br><small>正解数</small></div><div><b>'+rate+'%</b><br><small>正答率</small></div></section><section class="card"><h3>使い方</h3><p class="muted">Safariの共有ボタンから「ホーム画面に追加」を選ぶと、iPhoneのアプリのように起動できます。初回に問題を読み込んだ後、学習記録と問題データは端末に保存されます。</p></section>';}

  document.addEventListener('click', e => { const b=e.target.closest('button'); if(!b)return; const route=b.dataset.route; if(route){({home:renderHome,practice:renderPractice,review:renderReview,stats:renderStats})[route]();return;} if(b.dataset.choice)choose(b.dataset.choice); const a=b.dataset.action; if(a==='quick')start(shuffled(unique(questions)).slice(0,10),'ランダム10問'); if(a==='open-practice')renderPractice();if(a==='open-review')renderReview();if(a==='open-mock')renderMock();if(a==='start-filter'){const d=document.querySelector('#domain').value,l=document.querySelector('#level').value,n=+document.querySelector('#count').value;const pool=unique(questions.filter(q=>(!d||q.domain.includes(d))&&(!l||q.difficulty===l)));if(!pool.length){alert('条件に合う問題がありません。');return;}start(shuffled(pool).slice(0,n),d||'分野別学習');}if(b.dataset.mock)start(buildMock(+b.dataset.mock),b.dataset.mock+'問模擬試験');if(a==='check')check();if(a==='next')next();if(a==='quit')renderHome();if(a==='go-home')renderHome();if(a==='toggle-save'){const id=session.ids[session.index];state.saved=state.saved.includes(id)?state.saved.filter(x=>x!==id):[...state.saved,id];save();renderQuestion();}if(a==='start-wrong')start(shuffled(state.wrong.map(byId).filter(Boolean)).map(q=>q.id),'間違い問題の復習');if(a==='start-saved')start(shuffled(state.saved.map(byId).filter(Boolean)).map(q=>q.id),'あとで復習');if(a==='review-wrong')start(shuffled(state.wrong.map(byId).filter(Boolean)).map(q=>q.id),'間違い問題の復習');if(a==='clear-history'&&confirm('このiPhone内の解答記録と復習リストを消去しますか？')){state={saved:[],wrong:[],attempts:0,correct:0};save();renderReview();}});
  load();
})();
