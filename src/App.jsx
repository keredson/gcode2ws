import { useState, useEffect, useRef } from 'react'
import { Row, Typography } from 'antd';
import 'github-fork-ribbon-css/gh-fork-ribbon.css'

import { Search } from './Search'
import { Printer } from './Printer'

const { Title } = Typography;


function App() {
  const [printers, set_printers] = useState([])

  const printers_ref = useRef(null)
  useEffect(() => {
    printers_ref.printers = printers;
  }, [printers]);

  function add_printer(ip, port) {
    port = port || 81
    console.log('app adding printer', ip, port, printers_ref.printers)
    const matching_printers = printers_ref.printers.filter(printer => ((printer.ip==ip) && (printer.port==port)))
    console.log(printers_ref.printers, ip, port, matching_printers)
    if (matching_printers.length) {
      console.log('printer at', ip, port, 'already connected')
    } else {
      let new_printers = [...printers_ref.printers]
      new_printers.push({ ip, port:port })
      set_printers(new_printers)
    }
  }

  function remove(i) {
    console.log('printers_ref.printers',printers_ref.printers)
    printers_ref.printers.splice(i, 1)
    set_printers([...printers_ref.printers])
  }

  return (
    <>
      <a class="github-fork-ribbon" target='_blank' href="https://github.com/keredson/gcode2ws" data-ribbon="Fork me on GitHub" title="Fork me on GitHub">Fork me on GitHub</a>
      <Title style={{textAlign:'center'}}>Send G-Code</Title>
      <Row gutter={[16, 16]}>
        <Search add_printer={(ip, port)=>add_printer(ip, port)} printer_count={printers.length} />
      {printers.map((printer, i) => <Printer key={i} printer={printer} close={()=>remove(i)} />)}
    </Row>
    </>
  )
}

export default App
