export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Apenas POST permitido');
    
    const { code, verifier, clientId, redirectUri, type } = req.body;
    
    // Validação de parâmetros de entrada
    if (!code || !verifier || !clientId || !redirectUri) {
        return res.status(400).json({ error: 'Parâmetros de autenticação ausentes.' });
    }
    
    try {
        // 1) Troca do Token
        const tokenResp = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                client_id: clientId,
                code,
                redirect_uri: redirectUri,
                code_verifier: verifier
            })
        });
        const tokenData = await tokenResp.json();
        if (!tokenResp.ok) return res.status(400).json({ error: tokenData.error_description || 'Falha no Token' });

        // 2) Busca de Contas com Header Obrigatório
        const accResp = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Deriv-App-ID': clientId }
        });
        const accJson = await accResp.json();
        if (!accResp.ok) return res.status(accResp.status).json({ error: accJson.error || 'Erro ao buscar contas' });

        const accounts = accJson.data || [];
        if (!accounts.length) return res.status(404).json({ error: 'Nenhuma conta de Options encontrada.' });

        // Seleção da conta (Demo ou Real)
        const selectedAcc = accounts.find(a => a.account_type === (type || 'demo')) || accounts[0];

        // 3) Geração do OTP
        const otpResp = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${selectedAcc.account_id}/otp`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'Deriv-App-ID': clientId }
        });
        const otpJson = await otpResp.json();
        
        if (!otpResp.ok || !otpJson?.data?.url) {
            return res.status(otpResp.status || 400).json({ error: otpJson.error || 'Falha ao gerar OTP' });
        }

        return res.status(200).json({ 
            url: otpJson.data.url, 
            account_id: selectedAcc.account_id, 
            account_type: selectedAcc.account_type 
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
