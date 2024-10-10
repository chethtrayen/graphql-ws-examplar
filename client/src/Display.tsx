import { gql, useSubscription } from "@apollo/client";

const subscription = gql`
  subscription {
    numberIncremented
  }
`;

const Display = () => {
  const { data, loading } = useSubscription(subscription);

  if (loading) {
    return <span>Subscription connected</span>;
  }

  return <span>data:: {data.numberIncremented}</span>;
};

export default Display;
