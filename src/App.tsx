import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Area, RolarParaTopo } from './components/Layout'
import EquipeColegio from './pages/coordenacao/EquipeColegio'
import InicioCoordenacao from './pages/coordenacao/InicioCoordenacao'
import Pedidos from './pages/coordenacao/Pedidos'
import ProfessoresEscola from './pages/coordenacao/ProfessoresEscola'
import ResultadosColegio from './pages/coordenacao/ResultadosColegio'
import ReuniaoPedagogica from './pages/coordenacao/ReuniaoPedagogica'
import TurmasEscola from './pages/coordenacao/TurmasEscola'
import Entrada from './pages/Entrada'
import PassoAPasso from './pages/PassoAPasso'
import InicioProfessor from './pages/professor/InicioProfessor'
import AvaliacaoDetalhe from './pages/solar/AvaliacaoDetalhe'
import Avaliacoes from './pages/solar/Avaliacoes'
import ColegioDetalhe from './pages/solar/ColegioDetalhe'
import Colegios from './pages/solar/Colegios'
import Configuracoes from './pages/solar/Configuracoes'
import EquipeSolar from './pages/solar/EquipeSolar'
import InicioSolar from './pages/solar/InicioSolar'
import ResultadosRede from './pages/solar/ResultadosRede'
import AlunosDaTurma from './pages/turma/AlunosDaTurma'
import Lancamento from './pages/turma/Lancamento'
import MaterialImpressao from './pages/turma/MaterialImpressao'
import ResultadosTurma from './pages/turma/ResultadosTurma'
import TurmaInicio from './pages/turma/TurmaInicio'

/** As páginas de uma turma, iguais para professor e coordenação (cada um com as próprias permissões). */
const rotasDeTurma = [
  <Route key="turma" path="turma/:turmaId" element={<TurmaInicio />} />,
  <Route key="alunos" path="turma/:turmaId/alunos" element={<AlunosDaTurma />} />,
  <Route key="lancar" path="lancar/:cadernoId/:turmaId" element={<Lancamento />} />,
  <Route key="resultados" path="resultados/:cadernoId/:turmaId" element={<ResultadosTurma />} />,
]

// HashRouter (endereços com #) funciona no GitHub Pages sem configuração de servidor.
export default function App() {
  return (
    <HashRouter>
      <RolarParaTopo />
      <Routes>
        <Route path="/" element={<Entrada />} />
        <Route path="/professor" element={<Area papel="professor" />}>
          <Route index element={<InicioProfessor />} />
          {rotasDeTurma}
        </Route>
        <Route path="/coordenacao" element={<Area papel="coordenacao" />}>
          <Route index element={<InicioCoordenacao />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="resultados" element={<ResultadosColegio />} />
          <Route path="turmas" element={<TurmasEscola />} />
          <Route path="professores" element={<ProfessoresEscola />} />
          <Route path="equipe" element={<EquipeColegio />} />
          {rotasDeTurma}
        </Route>
        <Route path="/solar" element={<Area papel="solar" />}>
          <Route index element={<InicioSolar />} />
          <Route path="colegios" element={<Colegios />} />
          <Route path="colegios/:colegioId" element={<ColegioDetalhe />} />
          <Route path="avaliacoes" element={<Avaliacoes />} />
          <Route path="avaliacoes/:avaliacaoId" element={<AvaliacaoDetalhe />} />
          <Route path="resultados" element={<ResultadosRede />} />
          <Route path="equipe" element={<EquipeSolar />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="turma/:turmaId" element={<TurmaInicio />} />
          <Route path="resultados/:cadernoId/:turmaId" element={<ResultadosTurma />} />
        </Route>
        <Route path="/imprimir/material/:cadernoId/:turmaId" element={<MaterialImpressao />} />
        <Route path="/imprimir/reuniao/:avaliacaoId" element={<ReuniaoPedagogica />} />
        <Route path="/imprimir/passo-a-passo/:papel" element={<PassoAPasso />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
