import { Button, Collapse, Skeleton } from "antd";
import { useState } from "react";
import styled from "styled-components";

const StyledCollapse = styled(Collapse)`
  &.ant-collapse-borderless > .ant-collapse-item {
    border-bottom: 1px solid ${({ theme }) => theme.token.colorBorder};
  }
`;

const Container = styled.div`
  position: relative;
  margin-bottom: ${({ theme }) => theme.token.marginLG}px;
`;

const Overlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(
    to top,
    ${({ theme }) => `${theme.token.colorBgContainer}e6`},
    ${({ theme }) => `${theme.token.colorBgContainer}80`}
  );
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom-left-radius: ${({ theme }) => theme.token.borderRadius}px;
  border-bottom-right-radius: ${({ theme }) => theme.token.borderRadius}px;
  z-index: 1;
`;

type LoadableCollapseProps = {
  panels: React.ReactNode[];
  loading?: boolean;
};

export const LoadableCollapse: React.FC<LoadableCollapseProps> = ({
  panels,
  loading,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  const visiblePanels = expanded ? panels : panels.slice(0, 3);

  return (
    <Container>
      <StyledCollapse
        accordion
        bordered={false}
        style={{ background: "transparent", borderRadius: 6 }}
      >
        {visiblePanels}
      </StyledCollapse>

      {!expanded && panels.length > 5 && (
        <Overlay>
          <Button type="link" onClick={() => setExpanded(true)}>
            Show {panels.length - 3} more...
          </Button>
        </Overlay>
      )}
    </Container>
  );
};
