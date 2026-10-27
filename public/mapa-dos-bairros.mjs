/**
 * Os bairros de barracas da Grande Lisboa, num mapa de satélite.
 *
 * São os 27 que o Expresso contou em junho de 2025, postos no mapa (o
 * "Mapa dos Bairros AML", feito à mão no Google My Maps a partir do artigo)
 * com um ponto por bairro. A Penajóia é um deles: é o bairro deste site, e
 * o marcador que abre este mapa está no céu dela (ver a anotação "Mapa dos
 * Bairros" em annotations.mjs).
 *
 * As coordenadas são as do mapa, tal e qual — longitude e latitude, em
 * graus (WGS84) —, menos as do Casal dos Estanques, das Marinhas do Tejo e
 * da Rua Moinho da Arroja, acertadas à mão sobre a fotografia de satélite
 * (com as coordenadas do rato do modo de desenvolvedor). Um bairro que já
 * foi deitado abaixo leva "demolido", e no mapa o nome leva "(demolido)" à
 * frente. Um bairro por linha, para scripts/fazer-vista-dos-bairros.py as
 * ler daqui sem haver outra lista a dizer coisas diferentes.
 */

// O artigo de onde saem os bairros. A data e o título vêm do próprio
// endereço do artigo.
export const FONTE = {
    jornal: 'Expresso',
    titulo: 'Há 27 bairros de barracas na Grande Lisboa',
    ano: 2025,
    mes: 6,
    dia: 5,
    endereco: 'https://expresso.pt/sociedade/2025-06-05-ha-27-bairros-de-barracas-na-grande-lisboa-trabalho-sou-seguranca-mas-tive-de-construir-uma-casa-ilegal-para-dar-um-teto-a-familia-99c5453d'
};

// A fotografia de satélite: a World Imagery da Esri, que sobre estes
// bairros é da Vantor (satélites WorldView), de 16 de setembro e de 30 de
// novembro de 2025 — a mais recente que se pode pôr num site. A dos
// ortofotomapas do Estado (OrtoSat, da DGT) é de 2023.
export const SATELITE = {
    endereco: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    creditos: 'Esri · Vantor',
    // Até onde há fotografia nítida nesta zona (30 cm por ponto).
    zoomMaximo: 19
};

// O bairro deste site, que no mapa vai em destaque.
export const PENAJOIA = 'Bairro da Penajóia';

export const BAIRROS = [
    { nome: 'Bairro do Raposo', lon: -9.192239, lat: 38.672613 },
    { nome: 'Bairro da Penajóia', lon: -9.182153, lat: 38.671623 },
    { nome: 'Bairro de Santa Marta de Corroios', lon: -9.147005, lat: 38.627027 },
    { nome: 'Bairro do Zambujal', lon: -9.123805, lat: 38.868564 },
    { nome: 'Bairro da Estrada Militar da Mina', lon: -9.245281, lat: 38.765007 },
    { nome: 'Bairro do Clarimundo', lon: -9.027305, lat: 38.912532 },
    { nome: 'Casal dos Estanques', lon: -9.078572, lat: 38.877227 },
    { nome: 'Traseiras da Improsit', lon: -9.027434, lat: 38.913857 },
    { nome: 'Marinhas do Tejo', lon: -9.088127, lat: 38.833571 },
    { nome: 'Bairro Talude Militar', lon: -9.135997, lat: 38.818424 },
    { nome: 'Quinta da Várzea / Cucos da Serra', lon: -9.157737, lat: 38.795063 },
    { nome: 'Barruncho', lon: -9.167744, lat: 38.799292 },
    { nome: 'Pomarinho', lon: -9.18252, lat: 38.801824, demolido: true },
    { nome: 'Rua Moinho da Arroja', lon: -9.188632, lat: 38.797147 },
    { nome: 'Quinta do Lamas', lon: -9.193677, lat: 38.779955 },
    { nome: 'Pombais / Urbeira', lon: -9.193358, lat: 38.775249 },
    { nome: 'Avenida Gulbenkian', lon: -9.195627, lat: 38.769458 },
    { nome: 'Estrada Padre Cruz', lon: -9.200169, lat: 38.768281 },
    { nome: 'Pátio Oliveira Mota', lon: -9.203229, lat: 38.765262 },
    { nome: 'Bairro de Montemor', lon: -9.201357, lat: 38.815389 },
    { nome: 'Quinta da Lage', lon: -9.221454, lat: 38.762577 },
    { nome: 'Outros Núcleos Dispersos', lon: -9.227706, lat: 38.763874 },
    { nome: 'Quinta do Pomar', lon: -9.253607, lat: 38.772096 },
    { nome: 'Estrada Militar do Alto da Damaia', lon: -9.223545, lat: 38.748294 },
    { nome: 'Cova da Moura', lon: -9.215457, lat: 38.744885 },
    { nome: 'Bairro do 1º Torrão', lon: -9.237074, lat: 38.670966 },
    { nome: 'Bairro do 2º Torrão', lon: -9.245502, lat: 38.667291 }
];
