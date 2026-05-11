export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Apenas POST permitido');
    
    const { code, verifier, clientId, redirectUri } = req.body;
    
    if (!code || !verifier || !clientId || !redirectUri) {
        return res.status(400).json({ error: 'Parâmetros ausentes' });
    }

    try {
        // 1) Troca o código pelo Token de Acesso
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
        if (!tokenResp.ok || !tokenData.access_token) {
            return res.status(400).json({ error: tokenData.error_description || 'Falha no Token' });
        }

        // 2) Busca a lista de contas (Com o Header Deriv-App-ID obrigatório)
        const accResp = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Deriv-App-ID': clientId
            }
        });
        
        const accJson = await accResp.json();
        const accounts = accJson.data || []; // A estrutura correta é .data
        
        if (!accounts.length) {
            return res.status(404).json({ error: 'Nenhuma conta encontrada' });
        }

        // Seleciona a conta (Prioriza a Demo para testes, mude para 'real' se preferir)
        const preferred = accounts.find(a => a.account_type === 'demo') || accounts[0];
        const accountId = preferred.account_id;

        // 3) Gera o OTP para o WebSocket
        const otpResp = await fetch(`https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Deriv-App-ID': clientId
            }
        });
        
        const otpJson = await otpResp.json();
        
        if (!otpResp.ok || !otpJson.data?.url) {
            return res.status(400).json({ error: 'Falha ao gerar URL de conexão' });
        }

        // Retorna tudo pronto para o seu index.html
        return res.status(200).json({ 
            url: otpJson.data.url, 
            account_id: accountId, 
            type: preferred.account_type 
        });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
