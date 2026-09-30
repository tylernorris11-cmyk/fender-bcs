import { AssessmentRegister, type RegisterParams } from '../assessments/AssessmentRegister';

export default function MethodStatementsPage({ searchParams }: { searchParams: RegisterParams }) {
  return <AssessmentRegister kind="METHOD_STATEMENT" searchParams={searchParams} />;
}
