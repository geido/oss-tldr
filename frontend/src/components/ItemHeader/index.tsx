import { Space, Tag, Tooltip } from "antd";

type ItemHeaderProps = {
  number: number;
  title: string;
  state: string;
  merged?: boolean; // optional — only relevant for PRs
};

export const ItemHeader: React.FC<ItemHeaderProps> = ({
  number,
  title,
  state,
  merged,
}) => {
  const status = merged ? "merged" : state;
  const color = state === "open" ? "green" : merged ? "purple" : "red";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Space>
        <strong>#{number}</strong>
        <Tooltip title={title}>
          <span
            style={{
              maxWidth: 350,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "inline-block",
              verticalAlign: "middle",
            }}
          >
            {title}
          </span>
        </Tooltip>
      </Space>
      <Tag color={color}>{status}</Tag>
    </div>
  );
};
