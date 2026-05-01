import React from 'react';

const ProposalViewer = ({ proposal, client }) => {
  if (!proposal) return null;

  const sections = proposal.content?.sections || [];
  const subtotal = proposal.subtotal || 0;
  const gst = proposal.gst || 0;
  const finalAmount = proposal.finalAmount || 0;

  return (
    <div className="bg-white text-black p-8 sm:p-12 shadow-2xl mx-auto border border-gray-200 printable-paper" id="proposal-printable-area" style={{ minHeight: '1056px', maxWidth: '816px' }}>
      {/* Header section matching the PDF style */}
      <div className="flex justify-between items-start mb-10">
        <div>
          <h1 className="text-4xl font-serif text-red-600 font-bold italic mb-1">JJ Studio</h1>
          <p className="text-lg italic font-semibold mb-2">-Reinventing your Interiors</p>
          <p className="text-sm font-medium">Avani Oxford, Laketwon</p>
          <p className="text-sm font-medium">Kolkata - 700 055</p>
        </div>
        <div className="text-right text-sm font-medium">
          <p>Email: deepa@jjstudio.in</p>
          <p>(M) : 9830015200</p>
          <p>(O) : 033 79697900</p>
        </div>
      </div>

      {/* Client details & Date */}
      <div className="flex justify-between items-end border-t border-gray-300 pt-6 mb-8">
        <div>
          <p className="font-bold underline mb-1">To</p>
          <p className="font-bold">{client?.name || 'Client Name'}</p>
          <p className="font-medium">{client?.address || 'Client Address'}</p>
        </div>
        <div>
          <p className="font-bold underline">Dt. {new Date(proposal.createdAt || Date.now()).toLocaleDateString('en-GB').replace(/\//g, '.')}</p>
        </div>
      </div>

      {/* Subject */}
      <div className="mb-8">
        <p className="font-bold underline text-center">Sub :- {proposal.title || 'Estimate for interior works'}</p>
      </div>

      {/* Intro */}
      <div className="space-y-4 mb-8 text-sm font-medium">
        <p className="font-bold">Dear {client?.name?.split(' ')[0] || 'Sir/Madam'},</p>
        <div className="flex gap-4">
          <span>1)</span>
          <p>We will provide all the necessary services and skill to the best of our ability during the designing and execution of the above mentioned property.</p>
        </div>
        <div className="flex gap-4">
          <span>2)</span>
          <p>Estimated cost of the project as follows :-</p>
        </div>
      </div>

      {/* Dynamic Tables (Sections) */}
      <div className="space-y-8 mb-8">
        {sections.map((section, sIdx) => {
          const columns = section.structure?.columns || [];
          const rows = section.structure?.rows || [];

          return (
            <div key={section.id} className="overflow-hidden">
              <h3 className="font-bold text-md mb-2">{sIdx + 1}. {section.title}</h3>
              <div className="border border-black">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-gray-50 border-b border-black">
                    <tr>
                      <th className="px-2 py-2 border-r border-black font-bold text-center w-12">S.No.</th>
                      {columns.map((col) => (
                        <th key={col.id} className="px-3 py-2 border-r border-black font-bold text-center">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length + 1} className="px-4 py-8 text-center italic text-gray-500">
                          Empty section structure
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, rIdx) => (
                        <tr key={row.id} className={`${row.isGroupHeader ? 'bg-gray-100' : ''}`}>
                          <td className="px-2 py-2 text-center border-b border-r border-gray-300 border-black font-medium text-xs">
                            {row.isGroupHeader ? '' : `${String.fromCharCode(97 + (rIdx % 26))})`}
                          </td>
                          
                          {row.isGroupHeader ? (
                            <td colSpan={columns.length} className="px-3 py-2 border-b border-black font-bold">
                              {row.cells[columns[0]?.id] || 'Unnamed Group'}
                            </td>
                          ) : (
                            columns.map((col, idx) => (
                              <td key={col.id} className={`px-3 py-2 border-b border-r border-gray-300 border-black font-medium ${col.type === 'number' || idx === columns.length - 1 ? 'text-right' : ''}`}>
                                {row.cells[col.id] || ''}
                              </td>
                            ))
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {/* Grand Totals */}
        <div className="border border-black mt-8">
          <table className="w-full text-left text-sm border-collapse">
            <tbody>
              <tr>
                <td className="px-3 py-2 text-right font-bold border-r border-black border-b w-3/4">Sub Total</td>
                <td className="px-3 py-2 text-right font-bold border-b border-black w-1/4">{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="px-3 py-2 text-right font-bold border-r border-black border-b w-3/4">GST (18%)</td>
                <td className="px-3 py-2 text-right font-bold border-b border-black w-1/4">{gst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr className="bg-gray-100">
                <td className="px-3 py-2 text-right font-bold border-r border-black w-3/4">Total Project Cost</td>
                <td className="px-3 py-2 text-right font-bold border-black w-1/4">{finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms */}
      <div className="space-y-2 mb-12 text-sm font-medium pl-8">
        <p>ii) Any kind of accessories like Chandeliar, Art effects for décor of the handled on the actual Cost basis.</p>
        <p>iii) The above cost is an estimate for your reference, while the project will be handled on the actual Cost basis.</p>
      </div>

      {/* Footer Signoff */}
      <div className="text-sm font-bold mt-16">
        <p className="mb-8">Regards,</p>
        <p className="italic">for JJ Studio / Deepa Bagaria</p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-paper, .printable-paper * {
            visibility: visible;
          }
          .printable-paper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            padding: 0;
          }
        }
      `}} />
    </div>
  );
};

export default ProposalViewer;
