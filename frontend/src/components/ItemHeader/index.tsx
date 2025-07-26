import { Tag, Tooltip } from "antd";
import styled from "styled-components";

type ItemHeaderProps = {
  number: number;
  title: string;
  state: string;
  merged?: boolean; // optional — only relevant for PRs
};

const ResponsiveHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${({ theme }) => theme.token.paddingXS}px;
  min-width: 0;
`;

const TitleContainer = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.token.paddingXS}px;
`;

const ResponsiveTitle = styled.span`
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;

  @media (min-width: 480px) {
    max-width: 250px;
  }

  @media (min-width: 768px) {
    max-width: 350px;
  }
`;

export const ItemHeader: React.FC<ItemHeaderProps> = ({
  number,
  title,
  state,
  merged,
}) => {
  const status = merged ? "merged" : state;
  const color = state === "open" ? "green" : merged ? "purple" : "red";

  return (
    <ResponsiveHeader>
      <TitleContainer>
        <strong>#{number}</strong>
        <Tooltip title={title}>
          <ResponsiveTitle>{title}</ResponsiveTitle>
        </Tooltip>
      </TitleContainer>
      <Tag color={color}>{status}</Tag>
    </ResponsiveHeader>
  );
};
