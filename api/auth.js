export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Apenas POST permitido');
    const { code, verifier, clientId, redirectUri } = req.body;
    try {
        const tokenResp = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                code: code,
                redirect_uri: redirectUri,
                code_verifier: verifier
            })
        });
        const tokenData = await tokenResp.json();
        const accResp = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const accData = await accResp.json();
        const accountId = accData.accounts[0].account_id;
        const otpResp = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Deriv-App-ID': clientId }
        });
        const otpData = await otpResp.json();
        return res.status(200).json({ url: otpData.data.url });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
