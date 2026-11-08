// flair-metal-hash: 8392e603
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Returns the determinant of a 2x2 matrix.
static inline __attribute__((always_inline))
float spvDet2x2(float a1, float a2, float b1, float b2)
{
    return a1 * b2 - b1 * a2;
}

// Returns the inverse of a matrix, by using the algorithm of calculating the classical
// adjoint and dividing by the determinant. The contents of the matrix are changed.
static inline __attribute__((always_inline))
float3x3 spvInverse3x3(float3x3 m)
{
    float3x3 adj;	// The adjoint matrix (inverse after dividing by determinant)

    // Create the transpose of the cofactors, as the classical adjoint of the matrix.
    adj[0][0] =  spvDet2x2(m[1][1], m[1][2], m[2][1], m[2][2]);
    adj[0][1] = -spvDet2x2(m[0][1], m[0][2], m[2][1], m[2][2]);
    adj[0][2] =  spvDet2x2(m[0][1], m[0][2], m[1][1], m[1][2]);

    adj[1][0] = -spvDet2x2(m[1][0], m[1][2], m[2][0], m[2][2]);
    adj[1][1] =  spvDet2x2(m[0][0], m[0][2], m[2][0], m[2][2]);
    adj[1][2] = -spvDet2x2(m[0][0], m[0][2], m[1][0], m[1][2]);

    adj[2][0] =  spvDet2x2(m[1][0], m[1][1], m[2][0], m[2][1]);
    adj[2][1] = -spvDet2x2(m[0][0], m[0][1], m[2][0], m[2][1]);
    adj[2][2] =  spvDet2x2(m[0][0], m[0][1], m[1][0], m[1][1]);

    // Calculate the determinant as a combination of the cofactors of the first row.
    float det = (adj[0][0] * m[0][0]) + (adj[0][1] * m[1][0]) + (adj[0][2] * m[2][0]);

    // Divide the classical adjoint matrix by the determinant.
    // If determinant is zero, matrix is not invertable, so leave it unchanged.
    return (det != 0.0f) ? (adj * (1.0f / det)) : m;
}

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float2 uTopLeft;
    float2 uTopRight;
    float2 uBottomLeft;
    float2 uBottomRight;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_corner_pin_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float3x3 squareToQuad(thread const float2& p0, thread const float2& p1, thread const float2& p2, thread const float2& p3)
{
    float2 d1 = p1 - p2;
    float2 d2 = p3 - p2;
    float2 d3 = ((p0 - p1) + p2) - p3;
    float den = (d1.x * d2.y) - (d2.x * d1.y);
    float _258;
    if (abs(den) < 9.9999999392252902907785028219223e-09)
    {
        _258 = 0.0;
    }
    else
    {
        _258 = ((d3.x * d2.y) - (d2.x * d3.y)) / den;
    }
    float g = _258;
    float _281;
    if (abs(den) < 9.9999999392252902907785028219223e-09)
    {
        _281 = 0.0;
    }
    else
    {
        _281 = ((d1.x * d3.y) - (d3.x * d1.y)) / den;
    }
    float h = _281;
    return float3x3(float3((p1.x - p0.x) + (g * p1.x), (p1.y - p0.y) + (g * p1.y), g), float3((p3.x - p0.x) + (h * p3.x), (p3.y - p0.y) + (h * p3.y), h), float3(p0.x, p0.y, 1.0));
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _61)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_61.uBackdrop) * _61.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_61.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _61)
{
    float4 _205;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _205 = overBackdrop(param, _61);
    }
    else
    {
        float2 param_1 = fract(uv);
        _205 = float4(testCard(param_1), 1.0);
    }
    return _205;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _61, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_61.iResolution[0], _61.iResolution[1]);
    float2 param = _61.uBottomLeft;
    float2 param_1 = _61.uBottomRight;
    float2 param_2 = _61.uTopRight;
    float2 param_3 = _61.uTopLeft;
    float3 q = spvInverse3x3(squareToQuad(param, param_1, param_2, param_3)) * float3(uv, 1.0);
    float2 st = q.xy / float2(q.z);
    float2 px = fast::max(fwidth(st), float2(9.9999999747524270787835121154785e-07));
    float2 inside = fast::min(st, float2(1.0) - st) / px;
    float _408;
    if (q.z > 0.0)
    {
        _408 = fast::clamp(fast::min(inside.x, inside.y) + 0.5, 0.0, 1.0);
    }
    else
    {
        _408 = 0.0;
    }
    float cover = _408;
    float4 back = float4(_61.uBackdrop[0], _61.uBackdrop[1], _61.uBackdrop[2], _61.uBackdropAlpha);
    float2 param_4 = fast::clamp(st, float2(0.0), float2(1.0));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _61);
    float alpha = mix(back.w, pic.w, cover);
    fragColor = float4(mix(back.xyz * back.w, pic.xyz * pic.w, float3(cover)) / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

fragment flair_corner_pin_frag_out flair_corner_pin_frag(constant FlairUniforms& _61 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_corner_pin_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _478;
    if (_61.flair_flipY > 0.5)
    {
        _478 = _61.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _478 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _478);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _61, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

