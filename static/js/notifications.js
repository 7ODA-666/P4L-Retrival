// notifications.js
(function(){
  // Ensure container exists
  function ensureContainer(){
    let c = document.getElementById('notify-container');
    if(!c){
      c = document.createElement('div');
      c.id = 'notify-container';
      document.body.appendChild(c);
    }
    return c;
  }

  const ICONS = {
    info: 'fa-circle-info',
    success: 'fa-circle-check',
    warn: 'fa-triangle-exclamation',
    error: 'fa-triangle-exclamation'
  };

  window.showNotification = function(message, type='info', opts={}){
    const container = ensureContainer();
    const note = document.createElement('div');
    note.className = `notify notify-${type}`;
    note.role = 'alert';

    const icon = ICONS[type] || ICONS.info;
    note.innerHTML = `
      <div class="notify-inner">
        <div class="notify-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="notify-body">${message}</div>
        <button class="notify-close" aria-label="Close">&times;</button>
      </div>
    `;

    // click close
    note.querySelector('.notify-close').addEventListener('click', ()=>dismiss(note));

    container.appendChild(note);

    // force reflow then add visible class
    requestAnimationFrame(()=>{
      note.classList.add('notify-in');
    });

    const timeout = opts.timeout===0?0:(opts.timeout||4000);
    if(timeout>0){
      note._t = setTimeout(()=>dismiss(note), timeout);
    }

    function dismiss(el){
      if(!el) return;
      clearTimeout(el._t);
      el.classList.remove('notify-in');
      el.classList.add('notify-out');
      el.addEventListener('transitionend', ()=>{
        try{ el.remove(); }catch(e){}
      });
    }

    return note;
  };
})();

