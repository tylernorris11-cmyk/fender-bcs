import { AssessmentDetail } from '../../assessments/AssessmentPages';

export default function MethodStatementPage({ params }: { params: { id: string } }) {
  return <AssessmentDetail kind="METHOD_STATEMENT" id={params.id} />;
}
