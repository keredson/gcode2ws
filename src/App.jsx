import { useState } from 'react'
import { Card, Col, Row } from 'antd';

import { Search } from './Search'
import { Printer } from './Printer'


function App() {
  const [printers, set_printers] = useState([])

  function add_printer(ip, port) {
    let new_printers = [...printers]
    new_printers.push({ ip, port:port||81 })
    set_printers(new_printers)
  }

  return (
    <Row gutter={[16, 16]}>
      {printers.map((printer, i) => <Printer key={i} printer={printer} />)}
      <Search add_printer={(ip, port)=>add_printer(ip, port)} />
    </Row>
  )
}

export default App
