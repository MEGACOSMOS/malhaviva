/**
 * Onde vivem os vídeos e que versões existem de cada um.
 *
 * Todos os vídeos estão guardados na nuvem (Cloudflare R2), cada um em
 * várias resoluções. Este ficheiro é a única lista dessas versões: tanto o
 * player das entrevistas como o player das rotas 360º vão buscar aqui os
 * endereços, para não haver duas listas a dizer coisas diferentes.
 */

const BASE = 'https://pub-0a409b596f304409941ca1f88f3b593b.r2.dev/';

// As versões feitas a partir do original, da mais nítida para a mais leve.
// É por esta ordem que aparecem no menu, logo a seguir ao original.
export const RESOLUCOES = ['1440p', '1080p', '720p', '480p'];

// Rótulo do ficheiro original de cada vídeo, tal como saiu da montagem.
//
// As entrevistas foram filmadas em 4K (3840 x 2160), por isso o 2160p diz
// tudo. As rotas 360º são 8K e muito mais largas — a imagem dá a volta
// toda ao observador — e como os números terminados em "p" só contam as
// linhas, ficariam a esconder metade da história. Nessas, o rótulo diz
// quantos pontos tem na horizontal.
const ROTULO_ORIGINAL = '2160p';
const ROTULO_ORIGINAL_360 = '8K (7680 px)';
const VIDEOS_360 = ['Esvarena - 360 - A', 'Esvarena - 360 - B', 'Esvarena - 360 - C'];

/**
 * Como se chama a versão original de um vídeo no menu de qualidade.
 *
 * @param {string} nome - Nome do vídeo.
 * @returns {string} O rótulo a mostrar.
 */
export function rotuloOriginal(nome) {
    return VIDEOS_360.includes(nome) ? ROTULO_ORIGINAL_360 : ROTULO_ORIGINAL;
}

/**
 * Se um vídeo é uma rota 360º (uma imagem que dá a volta ao observador).
 *
 * @param {string} nome - Nome do vídeo.
 * @returns {boolean} Verdadeiro nas rotas.
 */
export function e360(nome) {
    return VIDEOS_360.includes(nome);
}

/**
 * Se um rótulo corresponde à versão original de um vídeo.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {string} resolucao - O rótulo a testar.
 * @returns {boolean} Verdadeiro se for o original.
 */
export function eOriginal(nome, resolucao) {
    return resolucao === rotuloOriginal(nome);
}

// Quantas linhas tem cada versão. É por aqui que se sabe se uma versão é
// mais nítida do que o ecrã consegue mostrar — nesse caso só gastaria
// dados sem se ver diferença.
const ALTURAS = { '1440p': 1440, '1080p': 1080, '720p': 720, '480p': 480 };

/**
 * Quantas linhas tem uma versão de um vídeo.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {string} resolucao - Rótulo da versão.
 * @returns {number} Altura em pontos.
 */
export function alturaDe(nome, resolucao) {
    if (eOriginal(nome, resolucao)) return e360(nome) ? 3840 : 2160;
    return ALTURAS[resolucao] || 0;
}

// Quantos megabits por segundo é preciso conseguir descarregar para cada
// versão correr sem parar. São valores medidos nos ficheiros verdadeiros,
// arredondados para cima — as rotas 360º pesam bastante mais porque a
// imagem cobre tudo à volta.
const DEBITOS = {
    entrevista: { '480p': 0.3, '720p': 0.7, '1080p': 1.8, '1440p': 8, original: 48 },
    rota360: { '480p': 0.9, '720p': 2.4, '1080p': 7, '1440p': 19, original: 46 }
};

/**
 * Quanto pesa, por segundo, uma versão de um vídeo.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {string} resolucao - Rótulo da versão.
 * @returns {number} Megabits por segundo.
 */
export function debitoDe(nome, resolucao) {
    const tabela = e360(nome) ? DEBITOS.rota360 : DEBITOS.entrevista;
    return eOriginal(nome, resolucao) ? tabela.original : (tabela[resolucao] || 0);
}

// Versões que ainda não foram carregadas para a nuvem. Enquanto estiverem
// aqui, não aparecem no menu — assim ninguém escolhe uma qualidade que
// depois não abre. De momento estão todas lá; a lista fica para quando
// entrar um vídeo novo que ainda só tenha algumas versões prontas.
const POR_CARREGAR = {};

/**
 * As resoluções que existem mesmo de um vídeo.
 *
 * @param {string} nome - Nome do vídeo, sem resolução nem extensão.
 * @returns {string[]} Resoluções disponíveis, da mais nítida para a mais leve.
 */
export function resolucoesDe(nome) {
    const emFalta = POR_CARREGAR[nome] || [];
    return [rotuloOriginal(nome)].concat(RESOLUCOES.filter(r => !emFalta.includes(r)));
}

/**
 * O endereço de uma versão de um vídeo.
 *
 * @param {string} nome - Nome do vídeo.
 * @param {string} resolucao - Por exemplo '1080p'.
 * @returns {string} Endereço completo.
 */
export function enderecoDe(nome, resolucao) {
    const original = resolucao === rotuloOriginal(nome);
    const ficheiro = original ? `${nome}.mp4` : `${nome}_${resolucao}.mp4`;
    return BASE + encodeURIComponent(ficheiro);
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
