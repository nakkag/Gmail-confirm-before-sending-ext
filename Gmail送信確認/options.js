document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.sync.get({
		delay: 3
	}, function(items) {
		document.getElementById('delay').value = items.delay;
	});
});
document.getElementById('save').addEventListener('click', () => {
	let delay = parseInt(document.getElementById('delay').value);
	if (delay < 0 || delay > 999) {
		delay = 3;
	}
	chrome.storage.sync.set({
		delay: delay
	}, function() {
		const status = document.getElementById('status');
		status.textContent = '保存しました。';
		setTimeout(function() {
			status.textContent = '';
		}, 3000);
	});
});
