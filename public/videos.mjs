/**
 * Onde vivem os vídeos e que versões existem de cada um.
 *
 * Todos os vídeos estão guardados na nuvem (Cloudflare R2), cada um em
 * várias resoluções. Este ficheiro é a única lista dessas versões: tanto o
 * player das entrevistas como o player das rotas 360º vão buscar aqui os
 * endereços, para não haver duas listas a dizer coisas diferentes.
 */

const BASE = 'https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/';

// Da mais nítida para a mais leve. É por esta ordem que aparecem no menu.
export const RESOLUCOES = ['1440p', '1080p', '720p', '480p'];

// Versões que ainda não foram carregadas para a nuvem. Enquanto estiverem
// aqui, não aparecem no menu — assim ninguém escolhe uma qualidade que
// depois não abre.
const POR_CARREGAR = {
    'Esvarena - 360 - B': ['1440p', '720p']
};

/**
 * As resoluções que existem mesmo de um vídeo.
 *
 * @param {string} nome - Nome do vídeo, sem resolução nem extensão.
 * @returns {string[]} Resoluções disponíveis, da mais nítida para a mais leve.
 */
export function resolucoesDe(nome) {
    const emFalta = POR_CARREGAR[nome] || [];
    return RESOLUCOES.filter(r => !emFalta.includes(r));
}

/**
 * O endereço de uma versão de um vídeo.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {string} resolucao - Por exemplo '1080p'.
 * @returns {string} Endereço completo.
 */
export function enderecoDe(nome, resolucao) {
    return BASE + encodeURIComponent(`${nome}_${resolucao}.mp4`);
}

/**
 * Todas as versões de um vídeo, prontas a dar ao player.
 *
 * @param {string} nome - Nome do vídeo.
 * @returns {Object<string, string>} Resolução → endereço.
 */
export function fontesDeVideo(nome) {
    const fontes = {};
    resolucoesDe(nome).forEach((r) => {
        fontes[r] = enderecoDe(nome, r);
    });
    return fontes;
}

/**
 * Que resolução deve começar a tocar, conforme o equipamento e a escolha
 * de qualidade guardada nas definições do site.
 *
 * O 1440p nunca arranca sozinho: são ficheiros muito pesados, ficam
 * reservados para quem os escolher de propósito.
 *
 * @param {string[]} disponiveis - Resoluções deste vídeo.
 * @returns {string} A resolução por onde começar.
 */
export function resolucaoDeArranque(disponiveis) {
    const lista = disponiveis && disponiveis.length ? disponiveis : RESOLUCOES;

    let qualidade = null;
    try {
        qualidade = localStorage.getItem('quality');
    } catch (e) {
        qualidade = null;
    }
    if (!qualidade || qualidade === 'auto') {
        qualidade = detetarEquipamento();
    }

    const preferidas = qualidade === 'low' ? ['480p', '720p', '1080p', '1440p'] :
        qualidade === 'med' ? ['720p', '1080p', '480p', '1440p'] :
            ['1080p', '720p', '1440p', '480p'];

    return preferidas.find(r => lista.includes(r)) || lista[0];
}

/**
 * Adivinha a força do equipamento, com as mesmas regras do resto do site.
 *
 * @returns {string} 'low', 'med' ou 'high'.
 */
function detetarEquipamento() {
    const telemovel = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const ecraPequeno = window.matchMedia('(max-width: 768px)').matches;
    const toque = (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    if (telemovel || (ecraPequeno && toque)) return 'low';

    const nucleos = navigator.hardwareConcurrency || 4;
    return nucleos <= 6 ? 'med' : 'high';
}
