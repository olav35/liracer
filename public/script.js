/* ========= *
 * CONSTANTS *
 * ========= */
const codefield = document.getElementsByClassName("codefield")[0]
// TODO: Use wss:// protocol. Currently s/ws/wss/ results in "WebSocket network
//       error: The operation couldn’t be completed. (OSStatus error -9847.)". I
//       will figure out how to remedy this at a later time.
const socket = new WebSocket(`ws://${document.location.host}/ws`)

/* ========== *
 * ROOM STATE *
 * ========== */
let snippet = undefined
let opponentCorrectChars = {
	// ID: correctChars
}
let correctChars = 0
let incorrectChars = 0

/* =========== *
 * OTHER STATE *
 * =========== */
let roomID = undefined
let roundID = undefined

/* ========= *
 * FUNCTIONS *
 * ========= */
// renderSnippet renders a snippet snip to the codefield, overwriting any
// previous text.
const renderCodefield = () => {
	codefield.textContent = ""
	snippet.split("").forEach((c, i) => {
		const s = document.createElement("span")
		if (c === "\n") {
			s.textContent = "↵\n"
			s.classList.add("codefield-character-newline")
		} else {
			s.textContent = c
		}
		s.classList.add("codefield-character")
		if (i < correctChars) {
			s.classList.add("codefield-character-correct")
		} else if (i < correctChars + incorrectChars) {
			s.classList.add("codefield-character-incorrect")
		} else if (i === correctChars + incorrectChars) {
			s.classList.add("codefield-character-player")
		}
		Object.values(opponentCorrectChars).forEach(correctChars => {
			if (i === correctChars) {
				s.classList.add("codefield-character-opponent")
			}
		})

		codefield.appendChild(s)
	})
}

// send sends a JSON representation of obj to the server and logs it to the
// console.
const send = obj => {
	const s = JSON.stringify(obj)
	console.log('write: ' + s)
	socket.send(s)
}

// sendCorrectChars sends the number of correctly written characters, that is
// correctChars, to the server.
const sendCorrectChars = () => {
	send({
		'RoundID': roundID,
		'CorrectCharsMsg': {
			'CorrectChars': correctChars
		}
	})
}

// typeIncorrectChar "types" a incorrect character, that is increments
// incorrectChars and renders codefield.
const typeIncorrectChar = () => {
	incorrectChars++
	renderCodefield()
}

// deleteIncorrectChar "deletes" a incorrect character, that is it decrements
// incorrectChars and renders the codefield.
const deleteIncorrectChar = () => {
	incorrectChars--
	renderCodefield()
}

// typeCorrectChar "types" a correct character, that is increments correctChars,
// sends the updated correctChars to the server and renders the codefield.
const typeCorrectChar = () => {
	correctChars++
	sendCorrectChars()
	renderCodefield()
}

// deleteCorrectChar "deletes" a correct character, that is it decrements
// correctChars, sends the updated correctChars to the server correctChars and
// renders the codefield.
const deleteCorrectChar = () => {
	correctChars--
	sendCorrectChars()
	renderCodefield()
}

// restart restarts the room state.
const restart = () => {
	correctChars = 0
	incorrectChars = 0
	opponentCorrectChars = {}
	sendCorrectChars()
	renderCodefield()
}

// mapKeyToChar maps a key, as in the key field of a KeyboardEvent, to the
// character it represents.
const mapKeyToChar = key => {
	if(['Shift', 'Meta', 'Alt', 'Control', 'Backspace'].includes(key)){
		return null
	} else if (key === "Enter"){
		return "\n"
	} else if (key === 'Tab') {
		return "\t"
	} else {
		return key
	}
}

/* =========== *
 * ENTRY POINT *
 * =========== */
// renderCodefield(snip, correctChars, incorrectChars)

// TODO: wait until socket connection is opened before registering event
codefield.addEventListener("keydown", e => {
	if (e.key === "Tab") {
		// WHY: On Safari, pressing tab makes the browser focus the search
		//      field. calling e.preventDefault prevents this.
		e.preventDefault()
	}

	if(e.key === "Backspace") {
		if (incorrectChars > 0) {
			deleteIncorrectChar()
		} else if (correctChars > 0) {
			deleteCorrectChar()
		}
		return
	}

	const char = mapKeyToChar(e.key)
	if(char === null) {
		return
	}

	if(incorrectChars > 0) {
		typeIncorrectChar()
		return
	}

	if(char === snippet[correctChars]) {
		typeCorrectChar()
	} else {
		typeIncorrectChar()
	}

	if(correctChars === snippet.length) {
		restart()
	}
})

socket.addEventListener('message', e => {
	console.log("read: " + e.data)
	const m = JSON.parse(e.data)

	let isMessageHandled = false

	if(m['SetRoomStateMsg'] !== null) {
		isMessageHandled = true
		const payload = m['SetRoomStateMsg']

		snippet = payload['Snippet']
		renderCodefield()
	}
	if(m['OpponentCorrectCharsMsg'] !== null) {
		isMessageHandled = true
		const payload = m['OpponentCorrectCharsMsg']

		opponentCorrectChars[payload['OpponentID']] = payload['CorrectChars']
		renderCodefield()
	}
	if(!isMessageHandled) {
		alert('unhandled message: ' + e.data)
	}
})

socket.onopen = () => {
	send({
		'JoinRoomMsg': {
			'RoomID': 'dummyroomID'
		}
	})
}
