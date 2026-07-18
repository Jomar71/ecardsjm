const payload = {
    id: "test_" + Date.now(),
    "first-name": "Test",
    "last-name": "User"
};

fetch('https://ecardsjm.onrender.com/api/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
})
.then(async (res) => {
    console.log(res.status, res.statusText);
    console.log(await res.text());
})
.catch(console.error);