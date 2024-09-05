import { Space } from 'antd';


export function actionClicks(actions) {
  const action_style = { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, }
  return actions.map(action => (
    <span style={action_style} onClick={(e)=>action?.props?.onActionClick(e)}>{action}</span>
  ))
}

export function ActionWithText(props) {
  return <Space {...props} size={4} className='anticon'>{props.icon}{props.children}</Space>
}
