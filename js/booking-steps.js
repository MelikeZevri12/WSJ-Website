// Booking form steps, shared by the cruise page and the journey page (their booking modal's #bookingForm).
//   1. "What do you need?"  Book my spot now  /  Ask about pricing & availability
//   2. "Who's traveling?"   how many people + how many kids + each kid's age (always required)
//   3. Pricing question only: "Add the passenger details now?"  Yes / No, once I'm ready to book
//   then the page's own steps (data-step="you", "you-more", "cabin", "about", "review"), with one step per
//   other passenger (Passenger 2 of 5, 3 of 5...) inserted before "cabin".
// Book now (or a pricing question with "Yes"): everyone's name, date of birth, gender and citizenship are
// required (the lead's own fields are marked data-book-required). "No": those steps are skipped - the
// team's reply email then carries the family's own link to add them later (it updates the same request).
// Each page keeps its own submit; it reads BookingSteps' data() (requestType, travelers, kidAges, passengers).
(function () {
  const MAX_TRAVELERS = 30;
  const GENDERS = ['Female', 'Male', 'Prefer not to say', 'Other'];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function create(opts) {
    const form = opts.form;
    let passengers = []; // Passenger 2, 3, ... each {name, dob, gender, citizenship}
    let kidAges = [];
    let current = 0;

    // ---- the steps every booking starts with ----
    form.insertAdjacentHTML('afterbegin', `
      <div class="form-step" data-step="need">
        <div class="bs-step-title">What do you need?</div>
        <div class="bs-choices">
          <label class="bs-choice"><input type="radio" name="requestType" value="book" required>
            <span><strong>Book my spot now</strong><small>We'll get your cabin booked. We'll need everyone's details.</small></span></label>
          <label class="bs-choice"><input type="radio" name="requestType" value="pricing" required>
            <span><strong>Ask about pricing &amp; availability</strong><small>Get current prices and cabins for your family. Just tell us who's coming.</small></span></label>
        </div>
      </div>
      <div class="form-step" data-step="who">
        <div class="bs-step-title">Who's traveling?</div>
        <div class="bs-counts">
          <div class="field"><label for="bsTravelers">How many people are traveling, including you?</label>
            <input type="number" id="bsTravelers" inputmode="numeric" min="1" max="${MAX_TRAVELERS}" step="1" required placeholder="e.g. 4"></div>
          <div class="field"><label for="bsKids">How many of them are kids (under 18)?</label>
            <input type="number" id="bsKids" inputmode="numeric" min="0" step="1" required placeholder="e.g. 2"></div>
        </div>
        <div class="field" id="bsKidAgesField" hidden><label>Kids' ages</label><div class="bs-kid-ages" id="bsKidAges"></div></div>
        <div class="field-hint" id="bsWhoHint" hidden>More than one cabin is usually needed for 5 or more people; we'll quote that for you.</div>
      </div>
      <div class="form-step" data-step="details-now">
        <div class="bs-step-title">Add the passenger details now?</div>
        <div class="bs-choices">
          <label class="bs-choice"><input type="radio" name="detailsNow" value="yes" required>
            <span><strong>Yes, add them now</strong><small>Everyone's name, date of birth, gender and citizenship, so we can book you right away once you're happy with the price.</small></span></label>
          <label class="bs-choice"><input type="radio" name="detailsNow" value="no" required>
            <span><strong>No, I'll add them once I'm ready to book</strong><small>We'll send you a link to add them later.</small></span></label>
        </div>
      </div>`);
    const cabinStep = form.querySelector('[data-step="cabin"]');
    cabinStep.insertAdjacentHTML('beforebegin', '<div id="bsPassengerSteps"></div>');
    const $ = (id) => document.getElementById(id);

    const mode = () => (form.querySelector('input[name="requestType"]:checked') || {}).value || '';
    const detailsNow = () => (form.querySelector('input[name="detailsNow"]:checked') || {}).value || '';
    // Book now, or a pricing question where they chose to add the details now.
    const wantsDetails = () => mode() !== 'pricing' || detailsNow() !== 'no';
    const count = (id) => { const n = parseInt($(id).value, 10); return Number.isFinite(n) && n >= 0 ? n : 0; };
    const travelers = () => Math.min(count('bsTravelers'), MAX_TRAVELERS);
    const kids = () => Math.min(count('bsKids'), Math.max(travelers() - 1, 0));
    // Steps that don't apply right now are skipped: the "now or later?" question unless it's a pricing
    // question, and the passenger details when they chose "later".
    const skipped = (el) => (el.dataset.step === 'details-now' && mode() !== 'pricing') ||
      ((el.dataset.step === 'you-more' || el.dataset.step === 'passenger') && !wantsDetails());
    const steps = () => [...form.querySelectorAll('.form-step')].filter((el) => !skipped(el));

    // ---- Who's traveling ----
    function onCountsChange() {
      const n = travelers();
      // at least one adult travels
      $('bsKids').max = String(Math.max(n - 1, 0));
      $('bsWhoHint').hidden = n < 5;
      renderKidAges();
      renderPassengerSteps();
      updateProgress();
    }
    function renderKidAges() {
      const k = kids();
      kidAges = kidAges.slice(0, k);
      $('bsKidAgesField').hidden = !k;
      $('bsKidAges').innerHTML = Array.from({ length: k }, (_, i) => `
        <label class="bs-kid-age"><span>Kid ${i + 1}</span><input type="number" inputmode="numeric" min="0" max="17" step="1" required placeholder="Age" data-kid="${i}" value="${esc(kidAges[i] ?? '')}"></label>`).join('');
      $('bsKidAges').querySelectorAll('input').forEach((el) => el.addEventListener('input', () => { kidAges[+el.dataset.kid] = el.value; }));
    }
    $('bsTravelers').addEventListener('input', onCountsChange);
    $('bsKids').addEventListener('input', onCountsChange);

    // ---- one step per other passenger ----
    function renderPassengerSteps() {
      const n = Math.max(travelers(), 1);
      while (passengers.length < n - 1) passengers.push({ name: '', dob: '', gender: '', citizenship: '' });
      passengers = passengers.slice(0, n - 1);
      $('bsPassengerSteps').innerHTML = passengers.map((p, i) => `
        <div class="form-step" data-step="passenger" style="display:none;">
          <div class="bs-step-title">Passenger ${i + 2} of ${n}</div>
          <div class="passenger-field-grid">
            <div class="field"><label>Full Name</label><input type="text" data-p="${i}" data-field="name" data-book-required value="${esc(p.name)}"></div>
            <div class="field"><label>Date of Birth</label><input type="date" data-p="${i}" data-field="dob" data-book-required value="${esc(p.dob)}"></div>
            <div class="field"><label>Gender</label><select data-p="${i}" data-field="gender" data-book-required><option value="">Select</option>${GENDERS.map((g) => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
            <div class="field"><label>Citizenship</label><input type="text" data-p="${i}" data-field="citizenship" data-book-required placeholder="e.g. United States" value="${esc(p.citizenship)}"></div>
          </div>
        </div>`).join('');
      $('bsPassengerSteps').querySelectorAll('[data-p]').forEach((el) => el.addEventListener('input', () => { passengers[+el.dataset.p][el.dataset.field] = el.value; }));
      applyMode();
    }

    // Details required whenever they're asked for; the button names what's being sent.
    function applyMode() {
      form.querySelectorAll('[data-book-required]').forEach((el) => { el.required = wantsDetails(); });
      opts.submitBtn.textContent = mode() === 'pricing' ? 'Send My Question' : 'Send Booking Request';
      updateProgress();
    }
    form.querySelectorAll('input[name="requestType"], input[name="detailsNow"]').forEach((r) => r.addEventListener('change', applyMode));

    // ---- moving between steps ----
    function updateProgress() {
      const all = steps(), shown = all.findIndex((el) => el.style.display !== 'none');
      const at = shown === -1 ? current : shown;
      opts.progressFill.style.width = Math.round(((at + 1) / all.length) * 100) + '%';
      opts.progressText.textContent = `Step ${at + 1} of ${all.length}`;
    }
    function show(i) {
      const all = steps();
      current = Math.max(0, Math.min(i, all.length - 1));
      form.querySelectorAll('.form-step').forEach((el) => { el.style.display = el === all[current] ? '' : 'none'; });
      const last = current === all.length - 1;
      opts.prevBtn.style.visibility = current === 0 ? 'hidden' : 'visible';
      opts.nextBtn.style.display = last ? 'none' : 'inline-block';
      opts.submitBtn.style.display = last ? 'inline-block' : 'none';
      updateProgress();
      if (last && opts.onReview) opts.onReview();
    }
    // Only the step on screen is checked - the browser's own message points at the missing field.
    function stepIsValid() {
      for (const el of steps()[current].querySelectorAll('input, select, textarea')) {
        if (!el.disabled && !el.checkValidity()) { el.reportValidity(); return false; }
      }
      return true;
    }
    opts.nextBtn.addEventListener('click', () => {
      if (!stepIsValid()) return;
      if (opts.beforeNext && opts.beforeNext(steps()[current].dataset.step) === false) return;
      show(current + 1);
    });
    opts.prevBtn.addEventListener('click', () => show(current - 1));
    form.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); });

    onCountsChange(); show(0);
    return {
      // What the page sends along with its own fields. "Later": no passenger details at all (the API then
      // gives the team's reply the family's link to add them).
      data() {
        const later = !wantsDetails();
        return {
          requestType: mode() || 'book',
          travelers: travelers() || null,
          kidAges: kidAges.slice(0, kids()).map((a) => parseInt(a, 10)).filter((a) => a >= 0),
          passengers: later ? [] : passengers.map((p) => ({ ...p })),
          ...(later ? { dob: '', gender: '', citizenship: '' } : {}),
        };
      },
      // Rows for the page's "Quick review before sending" box.
      summaryRows() {
        const ages = kidAges.slice(0, kids()).filter((a) => a !== '');
        return [
          ['Request', mode() === 'pricing' ? 'Pricing & availability question' : 'Book my spot now'],
          ['Travelers', travelers() ? `${travelers()}${kids() ? ` (${kids()} kid${kids() === 1 ? '' : 's'}: ages ${ages.join(', ')})` : ', no kids'}` : ''],
          ...(mode() === 'pricing' ? [['Passenger details', wantsDetails() ? 'Added now' : 'Later, once you\'re ready to book']] : []),
        ];
      },
      reset() {
        passengers = []; kidAges = [];
        onCountsChange(); show(0);
      },
      show,
    };
  }

  window.BookingSteps = { create };
})();
