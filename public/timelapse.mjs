/**
 * As fotografias de satélite do bairro, tiradas do Google Earth, pela
 * ordem das datas.
 *
 * São todas do mesmo sítio e com o mesmo enquadramento, por isso passar de
 * uma para a outra é ver o bairro a mudar sem nada saltar. Cada uma está
 * em duas medidas: a de 2048 pontos de largura é a que anda no timelapse
 * (leve, para se poder passar por todas); a de 4096 só se vai buscar para
 * a fotografia que está parada à frente de quem a olha, quando o ecrã — ou
 * o aproximar — pede mais pormenor.
 *
 * O ficheiro de cada uma chama-se pelo ano e pelo mês ("2009-10.jpg"). Os
 * créditos são os que o Google Earth grava no canto de cada fotografia: o
 * timelapse enche o ecrã e esse canto fica de fora, por isso são escritos
 * no leitor.
 *
 * Lido pelo mapa (o nome do marcador, a data na barra de cima) e pela
 * página do timelapse.
 */

const MAXAR = 'Google Earth · Image © 2026 Maxar Technologies';
const AIRBUS = 'Google Earth · Image © 2026 Airbus';

export const FOTOGRAFIAS = [
    { ano: 2009, mes: 10, creditos: 'Google Earth' },
    { ano: 2012, mes: 7, creditos: MAXAR },
    { ano: 2014, mes: 8, creditos: MAXAR },
    { ano: 2015, mes: 4, creditos: MAXAR },
    { ano: 2016, mes: 6, creditos: MAXAR },
    { ano: 2018, mes: 8, creditos: MAXAR },
    { ano: 2019, mes: 5, creditos: MAXAR },
    { ano: 2020, mes: 7, creditos: MAXAR },
    { ano: 2021, mes: 6, creditos: MAXAR },
    { ano: 2023, mes: 4, creditos: MAXAR },
    { ano: 2024, mes: 4, creditos: MAXAR },
    { ano: 2025, mes: 1, creditos: MAXAR },
    { ano: 2025, mes: 9, creditos: MAXAR },
    { ano: 2025, mes: 11, creditos: MAXAR },
    { ano: 2026, mes: 6, creditos: AIRBUS },
    { ano: 2026, mes: 8, creditos: AIRBUS }
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
    return '/timelapse/' + largura + '/' + foto.ano + '-' + String(foto.mes).padStart(2, '0') + '.jpg';
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
