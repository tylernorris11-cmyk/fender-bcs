import { AssessmentPrint } from '../../../assessments/AssessmentPages';

export default function PrintMethodStatementPage({ params }: { params: { id: string } }) {
  return <AssessmentPrint kind="METHOD_STATEMENT" id={params.id} />;
}
