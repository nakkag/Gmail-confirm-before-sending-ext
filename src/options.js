document.querySelectorAll('[data-locale]').forEach(elem => {
  elem.innerText = chrome.i18n.getMessage(elem.dataset.locale)
})

document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.sync.get({
		delay: 3,
		disableAutocompleteType: 1
	}, function(items) {
		document.getElementById('delay').value = items.delay;
		document.querySelector(`input[type='radio'][value='${items.disableAutocompleteType}']`).checked = true;
	});
});

document.getElementById('save').addEventListener('click', () => {
	let delay = parseInt(document.getElementById('delay').value);
	if (delay < 0 || delay > 999) {
		delay = 3;
	}
	chrome.storage.sync.set({
		delay: delay,
		disableAutocompleteType: parseInt(document.querySelector("input[type='radio']:checked").value)
	}, function() {
		const status = document.getElementById('status');
		status.innerHTML = chrome.i18n.getMessage("option_message_save");
		setTimeout(function() {
			status.textContent = '';
		}, 5000);
	});
});
