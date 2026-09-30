import { AssessmentRegister, type RegisterParams } from '../assessments/AssessmentRegister';

export default function RiskAssessmentsPage({ searchParams }: { searchParams: RegisterParams }) {
  return <AssessmentRegister kind="RISK_ASSESSMENT" searchParams={searchParams} />;
}
