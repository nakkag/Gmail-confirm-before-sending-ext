window.onload = function() {
	let sendInterval = null;

	let disableAutocompleteType = 0;
	chrome.storage.sync.get({
		disableAutocompleteType: 1
	}, function(items) {
		disableAutocompleteType = items.disableAutocompleteType;
	});

	document.addEventListener("keydown", (event) => {
		if (sendInterval || (event.key === "Escape" && document.querySelector(".gsc-modal"))) {
			event.stopPropagation();
			document.getElementById("gsc-cancel-send").click();
			return;
		}
		if (event.key === "Enter") {
			if (document.querySelector(".gsc-modal")) {
				if (document.activeElement && document.activeElement.tagName && document.activeElement.tagName.toLowerCase() !== "button") {
					event.stopPropagation();
					document.getElementById("gsc-confirm-send").click();
				}
				return;
			}
			if (event.ctrlKey || event.metaKey) {
				let dialog = event.target.closest("div[role='dialog']");
				if (!dialog) {
					dialog = event.target.closest("div[role='region']");
				}
				if (dialog) {
					event.stopPropagation();
					dialog.querySelector(".gsc-confirm-send-button").click();
					return;
				}
			}
			if (disableAutocompleteType !== 0) {
				// Enterキーでの補完を抑制
				event.stopPropagation();
				return;
			}
		}
		if (disableAutocompleteType !== 0 && event.key === "Tab") {
			let dialog = event.target.closest("div[role='dialog']");
			if (!dialog) {
				dialog = event.target.closest("div[role='region']");
			}
			if (dialog) {
				// Tabキーでの補完を抑制
				event.stopPropagation();
				return;
			}
		}
	}, true);

	const observer = new MutationObserver(() => {
		document.querySelectorAll("div.J-J5-Ji.btA div[role='button'][jslog]").forEach(s => setSendButton(s));
		document.querySelectorAll("div[peoplekit-id='noeiCf']").forEach(l => disableAutocomplete(l));
	});
	observer.observe(document.body, { childList: true, subtree: true });

	// ドメイン取得
	function getDomain(m) {
		const d = m.match(/[a-zA-Z0-9_.+-]+@(([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,})/);
		return (d) ? d[1] : "";
	}

	// オートコンプリートの無効化
	function disableAutocomplete(list) {
		if (list.style.display === "none" || disableAutocompleteType === 0) {
			return;
		}
		if (disableAutocompleteType === 2) {
			// オートコンプリート無効
			list.remove();
			return;
		}

		// 別ドメインのみオートコンプリート無効
		let domain = "";
		const from = list.querySelectorAll("input[name='from']");
		if (from.length > 0 && from[0].value) {
			domain = getDomain(from[0].value);
		} else {
			const m = document.title.match(/[a-zA-Z0-9_.+-]+@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/g);
			if (m && m.length > 0) {
				domain = getDomain(m.at(-1));
			}
		}
		if (domain) {
			list.querySelectorAll("div[role='option']").forEach(op => {
				const d = op.querySelector("div[data-hovercard-id]");
				if (d && d.dataset.hovercardId && domain !== getDomain(d.dataset.hovercardId)) {
					op.remove();
				}
			});
		}
		if (list.querySelectorAll("div[role='option']").length === 0) {
			list.style.display = "none";
		}
	}

	// 送信ボタンの置き換え
	function setSendButton(sendButton) {
		if (sendButton.dataset.gscAdded) {
			// 設定済
			return;
		}
		sendButton.dataset.gscAdded = "true";
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
		sendButton.classList.add("gsc-confirm");
		const newSendButton = sendButton.cloneNode(true);
		sendButton.style.display = "none";
		newSendButton.setAttribute("id", "");
		newSendButton.classList.add("gsc-confirm-send-button");
		sendButton.parentNode.appendChild(newSendButton);
		newSendButton.addEventListener("click", (e) => {
			chrome.storage.sync.get({
				delay: 3
			}, function(items) {
				showDialog(dialog, items.delay, sendButton.textContent, () => {
					sendButton.dispatchEvent(new MouseEvent("click"));
				});
			});
		});
		// その他の送信オプションの置き換え
		const otherSendButton = sendButton.nextElementSibling;
		if (otherSendButton) {
			otherSendButton.classList.add("gsc-confirm");
			const newOtherSendButton = otherSendButton.cloneNode(true);
			otherSendButton.style.display = "none";
			newOtherSendButton.setAttribute("id", "");
			otherSendButton.parentNode.appendChild(newOtherSendButton);
			newOtherSendButton.addEventListener("click", (e) => {
				showDialog(dialog, 0, sendButton.textContent, () => {
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
	}

	// 送信確認ダイアログの表示
	function showDialog(composeWindow, delay, sendText, callback) {
		if (document.querySelector(".gsc-modal")) {
			return;
		}
		if (composeWindow.querySelector("div[style^='width'][style*='%;']")) {
			// 添付ファイル追加中
			return;
		}

		// 差出人
		let domain = "";
		let from = composeWindow.querySelectorAll("input[name='from']");
		if (from.length > 0 && from[0].value) {
			from = from[0].value;
			domain = getDomain(from);
		} else {
			from = "";
			const m = document.title.match(/[a-zA-Z0-9_.+-]+@([a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/g);
			if (m && m.length > 0) {
				domain = getDomain(m.at(-1));
			}
		}

		// 宛先
		function getMailAddress(type, a) {
			let elms = composeWindow.querySelectorAll(`input[name='${type}']`);
			if (elms.length > 0) {
				elms.forEach(elm => {
					if (elm.value) {
						addAddress(a, elm.value, null);
					}
				});
			} else {
				composeWindow.querySelectorAll(`div[name='${type}'] div[data-hovercard-id]`).forEach(elm => {
					if (!elm.dataset.name && !elm.dataset.hovercardId) {
						retrun;
					}
					if (!elm.dataset.name || elm.dataset.name == elm.dataset.hovercardId) {
						addAddress(a, elm.dataset.hovercardId, null);
					} else {
						addAddress(a, elm.dataset.hovercardId, elm.dataset.name);
					}
				});
				composeWindow.querySelectorAll(`div[name='${type}'] span[peoplekit-id]`).forEach(span => {
					if (span.textContent) {
						addAddress(a, span.textContent, null);
					}
				});
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
			subject = `<span class="gsc-none-data">${chrome.i18n.getMessage("no_subject")}</span>`;
		}

		// 添付ファイル
		const attachments = [];
		composeWindow.querySelectorAll("input[name='attach']").forEach(a => {
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
			<div class="gsc-overlay">
				<div class="gsc-modal" tabindex="0">
					<h2>${chrome.i18n.getMessage("title")}</h2>
					<div class="gsc-contents">
						<div id="gsc-from">
							<h3>${chrome.i18n.getMessage("from")}</h3>
							<label><input type="checkbox" class="gsc-check">${from}</label>
							<hr />
						</div>
						<div>
							<h3>${chrome.i18n.getMessage("recipients")}</h3>
							<p id="gsc-to">To<br />${address.to.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<p id="gsc-cc">Cc<br />${address.cc.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<p id="gsc-bcc">Bcc<br />${address.bcc.map(email => `<label><input type="checkbox" class="gsc-check">${email}</label><br />`).join('')}</p>
							<hr />
						</div>
						<div>
							<h3>${chrome.i18n.getMessage("subject")}</h3>
							<label><input type="checkbox" class="gsc-check">${subject}</label>
							<hr />
						</div>
						<div>
							<h3>${chrome.i18n.getMessage("attach")}</h3>
							${attachments.length > 0 ? attachments.map(file => `<label><input type="checkbox" class="gsc-check">${file}</label><br>`).join('') : `<label class="gsc-none-data">${chrome.i18n.getMessage("no_attach")}</label>`}
						</div>
					</div>
					<div class="gsc-control">
						<button id="gsc-confirm-send" disabled>${sendText}</button>
						<button id="gsc-cancel-send">${chrome.i18n.getMessage("cancel")}</button>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(modal);
		if (!from || !composeWindow.querySelector("form[method='POST'] div[role='button'][aria-haspopup='true'][aria-expanded='false']")) {
			document.getElementById("gsc-from").remove();
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
		document.querySelector(".gsc-modal").focus();

		const confirmSend = document.getElementById("gsc-confirm-send");

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

		document.querySelector(".gsc-overlay").addEventListener("click", (e) => {
			if (sendInterval) {
				clearInterval(sendInterval);
				sendInterval = null;
				confirmSend.textContent = sendText;
			}
		});
	}
};
