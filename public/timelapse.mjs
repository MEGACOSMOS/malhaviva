/**
 * As fotografias de satélite do bairro, pela ordem das datas: as 15 imagens
 * da contagem de casas (Contagem de Casas, 2026), da de 2009 à de agosto de
 * 2026.
 *
 * Estão todas no mesmo enquadramento (o das exportações do Google Earth),
 * por isso passar de uma para a outra é ver o bairro a mudar sem nada
 * saltar. As que não são do Google Earth (Esri, DGT e o drone) foram
 * torcidas para cair em cima das outras ponto por ponto. Cada uma está em
 * duas medidas: a de 2048 pontos de largura é a que anda no timelapse (leve,
 * para se poder passar por todas); a de 4096 só se vai buscar para a
 * fotografia que está parada à frente de quem a olha, quando o ecrã — ou o
 * aproximar — pede mais pormenor.
 *
 * As fotografias vão sem as casas desenhadas e sem os números da contagem
 * enquanto a contagem é refeita (2026-11). Quando houver números de
 * confiança, cada fotografia pode levar `casas`, `novas` e `demolidas`, e o
 * leitor escreve-os por baixo da data (ver casasDa); sem eles não escreve
 * nada.
 *
 * O ficheiro de cada uma chama-se pelo ano e pelo mês ("2009-04.jpg"). Os
 * créditos são escritos no leitor, porque o timelapse enche o ecrã e o canto
 * onde vêm gravados fica de fora. Na do drone, só o bairro é do voo; à volta
 * é a fotografia do Google Earth de setembro de 2025.
 *
 * Lido pelo mapa (o nome do marcador, a data na barra de cima) e pela
 * página do timelapse.
 */

const MAXAR = 'Google Earth · Image © 2026 Maxar Technologies';
const AIRBUS = 'Google Earth · Image © 2026 Airbus';

export const FOTOGRAFIAS = [
    { ano: 2009, mes: 4, ficheiro: '2009-04', creditos: 'Google Earth' },
    { ano: 2011, mes: 3, ficheiro: '2011-03', creditos: 'Esri World Imagery Wayback' },
    { ano: 2014, mes: 12, ficheiro: '2014-12', creditos: 'Direção-Geral do Território · Ortofotomapas do litoral 2014–2015' },
    { ano: 2016, mes: 6, ficheiro: '2016-06', creditos: MAXAR },
    { ano: 2018, mes: 7, ficheiro: '2018-07', creditos: 'Direção-Geral do Território · Ortofotomapas 2018' },
    { ano: 2020, mes: 7, ficheiro: '2020-07', creditos: MAXAR },
    { ano: 2022, mes: 8, ficheiro: '2022-08', creditos: 'Esri World Imagery Wayback · Image © 2022 Maxar Technologies' },
    { ano: 2023, mes: 4, ficheiro: '2023-04', creditos: MAXAR },
    { ano: 2024, mes: 2, ficheiro: '2024-02', creditos: MAXAR },
    { ano: 2024, mes: 7, ficheiro: '2024-07', creditos: MAXAR },
    { ano: 2025, mes: 1, ficheiro: '2025-01', creditos: MAXAR },
    { ano: 2025, mes: 9, ficheiro: '2025-09', creditos: MAXAR },
    { ano: 2026, mes: 2, ficheiro: '2026-02', creditos: 'Ortofotomapa Malha Viva (drone, 15/02/2026) · à volta: Google Earth, set. 2025 · Image © 2026 Maxar Technologies' },
    { ano: 2026, mes: 6, ficheiro: '2026-06', creditos: AIRBUS },
    { ano: 2026, mes: 8, ficheiro: '2026-08', creditos: AIRBUS }
];

// As duas medidas, em pontos de largura. A altura vem com a fotografia
// (o feitio é o mesmo em todas).
export const LARGURA_LEVE = 2048;
export const LARGURA_NITIDA = 4096;

// O feitio das fotografias: largura a dividir pela altura.
export const FEITIO = 8192 / 6578;

/**
 * O endereço de uma fotografia, numa das duas medidas.
 *
 * @param {{ano: number, mes: number}} foto - A fotografia.
 * @param {number} largura - LARGURA_LEVE ou LARGURA_NITIDA.
 * @returns {string} O endereço.
 */
export function enderecoDa(foto, largura) {
    // ?v=4: as fotografias de 2026-11 têm alguns
    // nomes iguais às antigas; isto impede que fique a antiga guardada.
    return '/timelapse/' + largura + '/' + foto.ano + '-' + String(foto.mes).padStart(2, '0') + '.jpg?v=4';
}

/**
 * A data de uma fotografia, por extenso e na língua em vigor: "Outubro
 * 2009".
 *
 * @param {{ano: number, mes: number}} foto - A fotografia.
 * @returns {string} A data.
 */
export function dataDa(foto) {
    const meses = ((window.Idiomas && window.Idiomas.t('tl.meses')) || '').split(',');
    const mes = (meses[foto.mes - 1] || '').trim();
    return mes ? mes + ' ' + foto.ano : String(foto.ano);
}

/**
 * Os números de casas de uma fotografia, por extenso e na língua em vigor:
 * "613 casas · +20 novas · 0 demolidas" (na primeira, só o total).
 *
 * @param {{casas: number, novas?: number, demolidas?: number}} foto - A fotografia.
 * @returns {string} Os números.
 */
export function casasDa(foto) {
    // Com zero não leva sinal: "0 demolidas", e não "−0 demolidas".
    const t = (chave, n) => ((window.Idiomas && window.Idiomas.t(chave)) || '')
        .replace(n === 0 ? /[+−]?\{n\}/ : '{n}', String(n));
    if (foto.casas === undefined) return '';
    const partes = [t('tl.casas', foto.casas)];
    if (foto.novas !== undefined) {
        partes.push(t('tl.novas', foto.novas));
        partes.push(t('tl.demolidas', foto.demolidas));
    } else {
        partes.push(t('tl.inicio', ''));
    }
    return partes.filter(Boolean).join(' · ');
}
