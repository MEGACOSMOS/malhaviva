/**
 * A escolha automática entre os três modos de qualidade: Baixo, Médio e Alto.
 *
 * Olha para o tempo que cada imagem demora a ser desenhada. Quando o bairro
 * anda aos solavancos passa para o modo mais leve; quando há folga a sério
 * passa para o mais pesado. Nasceu do afinador de fluidez do antigo modo
 * Automático (`fluidez.mjs`), que mexia o pormenor em catorze degraus miúdos;
 * aqui há só três, e cada mudança vê-se. Por isso é mais paciente do que ele:
 *
 *  1. Conta as imagens lentas (mais de 34 milésimos de segundo), e não a
 *     média: uma média de 30 tanto pode ser certinha como metade a voar e
 *     metade a arrastar, e só a segunda se sente.
 *
 *  2. Desce depressa quando o aperto é grande (três segundos), e devagar
 *     quando é pequeno (doze). Se está mesmo a arrastar-se (menos de dez
 *     imagens por segundo), desce dois modos de uma vez.
 *
 *  3. Enquanto o bairro ainda está a chegar, as imagens saem sempre aos
 *     soluços: só conta um aperto grande que não passe.
 *
 *  4. Só sobe com folga a sério, seguida. E um modo de que se caiu não se
 *     tenta outra vez logo: espera cinco minutos. À segunda queda (ou a uma
 *     queda logo a seguir a ter subido) fica posto de parte por uns dias —
 *     quem guarda essa memória é a página (ver `qualidade`, no index.html).
 *     É isto que impede o vaivém entre dois modos, com uma vista leve a
 *     dizer que cabe e a vista pesada seguinte a dizer que não.
 *
 * Este ficheiro não toca no motor nem na página: recebe o tempo de cada
 * imagem e diz, por `aplicar`, o modo em que se deve estar. Assim pode ser
 * provado sem placa gráfica (ver `scripts/testar-escolha.mjs`).
 */

// Cada medição dura este tempo, em milissegundos.
const JANELA = 500;

// Uma imagem que demora mais do que isto (menos de 30 por segundo) é lenta.
const IMAGEM_LENTA = 34;

// Um intervalo maior do que este não é lentidão: é a janela que esteve parada.
// É largo de propósito: num aparelho muito fraco uma imagem pode mesmo demorar
// dois segundos, e é justamente a esse que é preciso acudir.
const PAUSA = 4000;

// Os graus de aperto: que parte das imagens foi lenta, em quantas medições.
const URGENTE = { janelas: 6, parte: 0.5 };
const GRAVE = { janelas: 12, parte: 0.25 };
const LEVE = { janelas: 24, parte: 0.1, mediaMaxima: 45 };
const MINIMO_DE_LENTAS = 3;

// Com o bairro a chegar as imagens saem aos soluços, mas não metade delas
// durante seis segundos seguidos: isso já é peso.
const A_CHEGAR = { janelas: 12, parte: 0.5, ate: 1 };

// Insuportável: conta mesmo com o bairro a chegar ou a assentar.
const INSUPORTAVEL = { janelas: 6, fps: 10 };

// Para subir: nenhuma imagem lenta e, pelo menos, tantas imagens por segundo,
// durante este tempo. Com folga de sobra espera-se metade.
const FPS_DE_FOLGA = 52;
const FPS_DE_MUITA_FOLGA = 100;
const ESPERA_PARA_SUBIR = 12000;

// Um modo de que se caiu há menos tempo do que isto não se tenta.
const ESPERA_DEPOIS_DE_CAIR = 5 * 60 * 1000;

// Cair tão pouco tempo depois de subir conta por duas quedas.
const CAIU_LOGO = 60000;

// Tempo a deixar assentar depois de cada mudança.
const ASSENTAR_NO_ARRANQUE = 3000;
const ASSENTAR_DEPOIS_DE_DESCER = 4000;
const ASSENTAR_DEPOIS_DE_SUBIR = 8000;
const ASSENTAR_DEPOIS_DE_PAUSA = 2000;

const TAMANHO_DO_DIARIO = 40;

/**
 * @param {object} opcoes
 * @param {string[]} opcoes.modos - Os modos, do mais leve ao mais pesado.
 * @param {string} opcoes.partida - O modo em que se começa.
 * @param {function(string, string): void} opcoes.aplicar - Chamada com o modo
 *     e o motivo (`'urgente'`, `'grave'`, `'leve'`, `'insuportavel'`,
 *     `'folga'`) quando se muda.
 * @param {function(string, number): void} [opcoes.aoCair] - Chamada com o modo
 *     de que se caiu, e por quantas quedas conta.
 * @param {function(string): boolean} [opcoes.postoDeParte] - Diz se um modo
 *     está posto de parte (caiu-se dele vezes a mais).
 * @param {function(): boolean} [opcoes.podeSubir] - Diz se agora se pode subir.
 * @param {function(string): boolean} [opcoes.pronto] - Diz se um modo acima já
 *     se pode pôr; se não, começa a prepará-lo, e volta-se a perguntar.
 * @param {function(): boolean} [opcoes.ocupado] - Diz se o bairro ainda está a
 *     chegar.
 * @param {function(): boolean} [opcoes.parado] - Diz se não se deve medir.
 * @returns {object} `quadro(agora)`, a chamar a cada imagem; `por(modo)`, para
 *     dizer que o modo mudou por outra via; e `diagnostico`.
 */
export function criarEscolhaDeModo(opcoes) {
    const { modos, aplicar } = opcoes;
    const parado = opcoes.parado || (() => false);
    const ocupado = opcoes.ocupado || (() => false);
    const podeSubir = opcoes.podeSubir || (() => true);
    const pronto = opcoes.pronto || (() => true);
    const postoDeParte = opcoes.postoDeParte || (() => false);
    const aoCair = opcoes.aoCair || (() => {});

    let indice = Math.max(0, modos.indexOf(opcoes.partida));
    let ultimo = 0;
    let janela = { imagens: 0, lentas: 0, tempo: 0 };
    let historico = [];
    let assentaAte = 0;
    let calmaDesde = 0;
    let folgaRecente = 0;
    let arrancou = false;
    let subiuEm = -Infinity;
    const caiuEm = modos.map(() => -Infinity);
    let ultimoFps = 0;
    const diario = [];

    // Cada medição leva o estado em que foi feita: 0, normal; 1, com o bairro a
    // chegar; 2, a assentar depois de uma mudança. `ate` diz o pior que se
    // aceita: havendo uma medição pior do que isso, não se conclui nada.
    function juntar(quantas, ate = 0) {
        if (historico.length < quantas) return null;
        const total = { imagens: 0, lentas: 0, tempo: 0 };
        for (let i = historico.length - quantas; i < historico.length; i++) {
            if (historico[i].estado > ate) return null;
            total.imagens += historico[i].imagens;
            total.lentas += historico[i].lentas;
            total.tempo += historico[i].tempo;
        }
        return total;
    }

    function aperta(grau) {
        const m = juntar(grau.janelas, grau.ate);
        if (!m || m.lentas < MINIMO_DE_LENTAS || m.lentas / m.imagens < grau.parte) return false;
        return !grau.mediaMaxima || m.imagens * 1000 / m.tempo < grau.mediaMaxima;
    }

    function mudarPara(novo, agora, espera, motivo) {
        diario.push({ instante: Math.round(agora), de: modos[indice], para: modos[novo], motivo });
        if (diario.length > TAMANHO_DO_DIARIO) diario.shift();
        indice = novo;
        historico = [];
        calmaDesde = 0;
        assentaAte = agora + espera;
        aplicar(modos[indice], motivo);
    }

    function descer(agora, passos, motivo) {
        const novo = Math.max(0, indice - passos);
        if (novo === indice) {
            historico = [];
            return;
        }
        const logo = agora - subiuEm < CAIU_LOGO;
        for (let k = indice; k > novo; k--) {
            caiuEm[k] = agora;
            aoCair(modos[k], logo && k === indice ? 2 : 1);
        }
        mudarPara(novo, agora, ASSENTAR_DEPOIS_DE_DESCER, motivo);
    }

    function fechar(agora) {
        const medicao = janela;
        janela = { imagens: 0, lentas: 0, tempo: 0 };
        ultimoFps = medicao.imagens * 1000 / medicao.tempo;

        medicao.estado = agora < assentaAte ? 2 : (ocupado() ? 1 : 0);
        historico.push(medicao);
        if (historico.length > LEVE.janelas) historico.shift();

        const pior = juntar(INSUPORTAVEL.janelas, 2);
        if (pior && pior.imagens * 1000 / pior.tempo < INSUPORTAVEL.fps) {
            descer(agora, 2, 'insuportavel');
            return;
        }

        // A assentar, ou com o bairro a chegar, as imagens não são ainda as do
        // modo: só conta um aperto grande que não passe.
        if (aperta(A_CHEGAR)) return descer(agora, 1, 'a chegar');
        if (medicao.estado > 0) {
            calmaDesde = 0;
            return;
        }

        if (aperta(URGENTE)) return descer(agora, 1, 'urgente');
        if (aperta(GRAVE)) return descer(agora, 1, 'grave');
        if (aperta(LEVE)) return descer(agora, 1, 'leve');

        if (medicao.lentas > 0 || ultimoFps < FPS_DE_FOLGA) {
            calmaDesde = 0;
            return;
        }
        if (!calmaDesde) {
            calmaDesde = agora - JANELA;
            folgaRecente = ultimoFps;
        }
        folgaRecente = Math.min(folgaRecente, ultimoFps);
        const espera = folgaRecente >= FPS_DE_MUITA_FOLGA ? ESPERA_PARA_SUBIR / 2 : ESPERA_PARA_SUBIR;
        if (agora - calmaDesde < espera) return;
        const acima = indice + 1;
        if (acima >= modos.length || postoDeParte(modos[acima]) ||
            agora - caiuEm[acima] < ESPERA_DEPOIS_DE_CAIR || !podeSubir()) return;
        if (!pronto(modos[acima])) return;
        subiuEm = agora;
        mudarPara(acima, agora, ASSENTAR_DEPOIS_DE_SUBIR, 'folga');
    }
    function recomecar(agora, espera) {
        janela = { imagens: 0, lentas: 0, tempo: 0 };
        historico = [];
        calmaDesde = 0;
        assentaAte = Math.max(assentaAte, agora + espera);
    }

    /**
     * A chamar a cada imagem desenhada.
     *
     * @param {number} agora - O instante dela, em milissegundos.
     */
    function quadro(agora) {
        if (parado()) {
            ultimo = 0;
            return;
        }
        if (!ultimo) {
            ultimo = agora;
            recomecar(agora, arrancou ? ASSENTAR_DEPOIS_DE_PAUSA : ASSENTAR_NO_ARRANQUE);
            arrancou = true;
            return;
        }
        const intervalo = agora - ultimo;
        ultimo = agora;
        if (intervalo > PAUSA) {
            recomecar(agora, ASSENTAR_DEPOIS_DE_PAUSA);
            return;
        }
        janela.imagens++;
        janela.tempo += intervalo;
        if (intervalo > IMAGEM_LENTA) janela.lentas++;
        if (janela.tempo >= JANELA) fechar(agora);
    }

    return {
        quadro,

        /** O modo mudou por outra via (quem visita escolheu, por exemplo). */
        por(modo) {
            const novo = modos.indexOf(modo);
            if (novo < 0) return;
            indice = novo;
            ultimo = 0;
            historico = [];
            calmaDesde = 0;
        },

        get modo() {
            return modos[indice];
        },

        get diagnostico() {
            return { modo: modos[indice], fps: Math.round(ultimoFps), medicoes: historico.length, diario: diario.slice() };
        }
    };
}
