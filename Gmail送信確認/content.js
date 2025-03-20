window.onload = function() {
	let sendInterval = null;

	document.addEventListener("keydown", (event) => {
		if (sendInterval || (event.key === "Escape" && document.getElementById("gsc-modal"))) {
			event.stopPropagation();
			document.getElementById("gsc-cancel-send").click();
			return;
		}
		if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
			event.stopPropagation();
			let dialog = event.target.closest("div[role='dialog']");
			if (!dialog) {
				dialog = event.target.closest("div[role='region']");
			}
			if (!dialog) {
				return;
			}
			dialog.querySelector(".gsc-confirm-send-button").click();
		}
	}, true);

	const observer = new MutationObserver(() => {
		// DOMツリーに変化があれば送信ボタンを確認する
		changeButton();
	});
	observer.observe(document.body, { childList: true, subtree: true });

	function changeButton() {
		const sendButtons = document.querySelectorAll("div[role='button'][aria-label^='送信']");
		sendButtons.forEach(sendButton => {
			if (sendButton.dataset.listenerAdded) {
				// 設定済
				return;
			}
			// アドレス等を取得するための親を取得
			let dialog = sendButton.closest("div[role='dialog']");
			if (!dialog) {
				dialog = sendButton.closest("div[role='region']");
			}
			if (!dialog) {
				return;
			}
			// 送信ボタンの置き換え
			const display = sendButton.style.display;
			sendButton.dataset.listenerAdded = "true";
			const newSendButton = sendButton.cloneNode(true);
			sendButton.style.display = "none";
			newSendButton.setAttribute("id", "");
			newSendButton.classList.add("gsc-confirm-send-button");
			newSendButton.classList.add("gsc-confirm");
			sendButton.parentNode.appendChild(newSendButton);
			newSendButton.addEventListener("click", (e) => {
				chrome.storage.sync.get({
					delay: 3
				}, function(items) {
					showDialog(dialog, items.delay, () => {
						sendButton.dispatchEvent(new MouseEvent("click"));
					});
				});
			});
			// その他の送信オプションの置き換え
			const otherSendButton = sendButton.nextElementSibling;
			if (otherSendButton) {
				const newOtherSendButton = otherSendButton.cloneNode(true);
				otherSendButton.style.display = "none";
				newOtherSendButton.setAttribute("id", "");
				newOtherSendButton.classList.add("gsc-confirm");
				otherSendButton.parentNode.appendChild(newOtherSendButton);
				newOtherSendButton.addEventListener("click", (e) => {
					showDialog(dialog, 0, () => {
						// ポップアップメニューを出すため一時的に元の送信ボタンを戻す
						sendButton.style.display = display;
						otherSendButton.style.display = display;
						newSendButton.style.display = "none";
						newOtherSendButton.style.display = "none";
						otherSendButton.focus();
						otherSendButton.dispatchEvent(new MouseEvent("mousedown"));
					});
				});
				otherSendButton.addEventListener("blur", (e) => {
					// 元の送信ボタンを再度隠す
					sendButton.style.display = "none";
					otherSendButton.style.display = "none";
					newSendButton.style.display = display;
					newOtherSendButton.style.display = display;
				});
			}
		});
	}

	function showDialog(composeWindow, delay, callback) {
		if (composeWindow.querySelector("div[style^='width'][style*='%;']")) {
			// 添付ファイル追加中
			return;
		}

		// 差出人
		const from = composeWindow.querySelectorAll("input[name='from']")[0].value;
		let domain = "";
		if (from) {
			domain = getDomain(from);
		} else {
			const m = document.title.match(/[a-zA-Z0-9_.+-]+@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/g);
			if (m && m.length > 0) {
				domain = getDomain(m.at(-1));
			}
		}
		function getDomain(m) {
			const d = m.match(/[a-zA-Z0-9_.+-]+@(([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,})/);
			return (d) ? d[1] : "";
		}

		// 宛先
		function getMailAddress(type, a) {
			let elms = composeWindow.querySelectorAll(`input[name='${type}']`);
			if (elms && elms.length > 0) {
				elms.forEach(elm => {
					if (elm.value) {
						addAddress(a, elm.value, null);
					}
				});
			} else {
				const elms = composeWindow.querySelectorAll(`div[name='${type}'] div[data-hovercard-id]`);
				if (elms && elms.length > 0) {
					elms.forEach(elm => {
						if (!elm.dataset.name && !elm.dataset.hovercardId) {
							retrun;
						}
						if (!elm.dataset.name || elm.dataset.name == elm.dataset.hovercardId) {
							addAddress(a, elm.dataset.hovercardId, null);
						} else {
							addAddress(a, elm.dataset.hovercardId, elm.dataset.name);
						}
					});
				}
				const spans = composeWindow.querySelectorAll(`div[name='${type}'] span[peoplekit-id]`);
				if (spans) {
					spans.forEach(span => {
						if (span.textContent) {
							addAddress(a, span.textContent, null);
						}
					});
				}
			}
		}
		function addAddress(arr, addr, name) {
			let str = "";
			if (name) {
				str = `${name} &lt;<span class="gsc-mail-addr">${addr}</span>&gt;`;
			} else {
				str = `<span class="gsc-mail-addr">${addr}</span>`;
			}
			if (domain !== getDomain(addr)) {
				// 別ドメインは色を変更
				arr.push(`<span class="gsc-diff-domain">${str}</span>`);
			} else {
				arr.push(str);
			}
		}
		const address = {to: [], cc: [], bcc: []};
		getMailAddress('to', address.to);
		getMailAddress('cc', address.cc);
		getMailAddress('bcc', address.bcc);

		// 件名
		let subject = composeWindow.querySelector("input[name='subjectbox']").value;
		if (!subject || !subject.trim()) {
			subject = `<span class="gsc-none-data">(件名なし)</span>`;
		}

		// 添付ファイル
		const attachments = [];
		const attaches = composeWindow.querySelectorAll("input[name='attach']");
		attaches.forEach(a => {
			if (a.nextElementSibling) {
				const attach = a.nextElementSibling;
				if (attach.firstElementChild) {
					let file = `<span class="gsc-attach-file">${attach.firstElementChild.textContent}</span>`;
					if (attach.firstElementChild.nextElementSibling) {
						file += ` ${attach.firstElementChild.nextElementSibling.textContent}`;
					}
					attachments.push(file);
				} else {
					attachments.push(attach.textContent);
				}
			}
		});

		// ダイアログの追加
		const modal = document.createElement("div");
		modal.innerHTML = `
			<div id="gsc-overlay" class="gsc-overlay">
				<div id="gsc-modal" class="gsc-modal" tabindex="0">
					<h2>送信確認</h2>
					<div class="gsc-contents">
						<div id="gsc-from">
							<h3>差出人</h3>
							<label><input type="checkbox" class="gsc-check">${from}</label>
							<hr />
						</div>
						<div>
							<h3>宛先</h3>
							<p id="gsc-to">To<br />${address.to.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<p id="gsc-cc">Cc<br />${address.cc.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<p id="gsc-bcc">Bcc<br />${address.bcc.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<hr />
						</div>
						<div>
							<h3>件名</h3>
							<label><input type="checkbox" class="gsc-check">${subject}</label>
							<hr />
						</div>
						<div>
							<h3>添付ファイル</h3>
							${attachments.length > 0 ? attachments.map(file => `<label><input type="checkbox" class="gsc-check">${file}</label><br>`).join('') : '<label class="gsc-none-data">(添付ファイルなし)</label>'}
						</div>
					</div>
					<div class="gsc-control">
						<button id="gsc-confirm-send" disabled>送信</button>
						<button id="gsc-cancel-send">キャンセル</button>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(modal);
		if (!from) {
			document.getElementById("gsc-from").style.display = "none";
		}
		if (!address.to.length) {
			document.getElementById("gsc-to").style.display = "none";
		}
		if (!address.cc.length) {
			document.getElementById("gsc-cc").style.display = "none";
		}
		if (!address.bcc.length) {
			document.getElementById("gsc-bcc").style.display = "none";
		}
		document.getElementById("gsc-modal").focus();

		const confirmSend = document.getElementById("gsc-confirm-send");
		const confirmSendText = confirmSend.textContent;

		document.querySelectorAll(".gsc-check").forEach((checkbox) => {
			checkbox.addEventListener("change", () => {
				const allChecked = document.querySelectorAll(".gsc-check");
				confirmSend.disabled = !Array.from(allChecked).every(cb => cb.checked);
			});
		});

		confirmSend.addEventListener("click", (e) => {
			if (sendInterval) {
				return;
			}
			if (delay === 0) {
				modal.remove();
				if (callback) {
					callback();
				}
				return;
			}
			e.stopPropagation();
			let time = delay;
			confirmSend.textContent = time;
			sendInterval = setInterval(() => {
				time--;
				confirmSend.textContent = time;
				if (time <= 0) {
					clearInterval(sendInterval);
					sendInterval = null;
					modal.remove();
					if (callback) {
						callback();
					}
				}
			}, 1000);
		});

		document.getElementById("gsc-cancel-send").addEventListener("click", (e) => {
			if (!sendInterval) {
				modal.remove();
			}
		});

		document.getElementById("gsc-overlay").addEventListener("click", (e) => {
			if (sendInterval) {
				clearInterval(sendInterval);
				sendInterval = null;
				confirmSend.textContent = confirmSendText;
			}
		});
	}
};
