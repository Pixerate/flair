// flair-metal-hash: e3204fb9
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
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
    float3 uColorA;
    float3 uColorB;
    float3 uColorC;
    packed_float3 uColorD;
    int uShape;
    int uRings;
    int uPoints;
    float uSpeed;
    uint uInward;
    float uTwist;
    float uSpin;
    float2 uCentre;
};

struct flair_concentric_shapes_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float shapeRadius(thread const float& th, thread const int& kind, thread const float& n)
{
    if (kind == 1)
    {
        float2 c = float2(cos(th), sin(th));
        c *= c;
        return 0.839999973773956298828125 / sqrt(sqrt(dot(c, c)));
    }
    if (kind == 2)
    {
        return 0.800000011920928955078125 + (0.20000000298023223876953125 * cos(th * n));
    }
    if (kind == 3)
    {
        return 0.5 + ((0.5 * abs(fract((th * n) / 6.28318023681640625) - 0.5)) * 2.0);
    }
    return 0.920000016689300537109375;
}

static inline __attribute__((always_inline))
float3 flatColour(thread const int& i, constant FlairUniforms& _54)
{
    int k = i - (4 * (i / 4));
    float3 _42;
    if (k == 0)
    {
        _42 = _54.uColorA;
    }
    else
    {
        float3 _63;
        if (k == 1)
        {
            _63 = _54.uColorB;
        }
        else
        {
            float3 _73;
            if (k == 2)
            {
                _73 = _54.uColorC;
            }
            else
            {
                _73 = float3(_54.uColorD);
            }
            _63 = _73;
        }
        _42 = _63;
    }
    return _42;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _54)
{
    float2 p = (fragCoord - (_54.uCentre * float2(_54.iResolution[0], _54.iResolution[1]))) / float2(_54.iResolution[1u]);
    float rr = length(p);
    float th = precise::atan2(p.y, p.x);
    float2 corner = (abs(_54.uCentre - float2(0.5)) + float2(0.5)) * float2(_54.iResolution[0u] / _54.iResolution[1u], 1.0);
    float spacing = length(corner) / float(_54.uRings);
    float flow = (_54.iTime * _54.uSpeed) * ((_54.uInward != 0u) ? (-1.0) : 1.0);
    float shift = fract(flow);
    float base = floor(flow);
    float px = 1.5 / _54.iResolution[1u];
    float n = float(_54.uPoints);
    float first = fast::max(floor((rr / spacing) - shift), 0.0);
    float3 col = float3(0.0);
    float acc = 0.0;
    float R;
    int _311;
    for (int k = 0; k < 28; k++)
    {
        float j = first + float(k);
        float rho = (j + shift) * spacing;
        float a = (th - ((_54.uTwist * rho) * 2.0)) - (_54.uSpin * _54.iTime);
        if (_54.uShape < 4)
        {
            float param = a;
            int param_1 = _54.uShape;
            float param_2 = n;
            R = shapeRadius(param, param_1, param_2);
        }
        else
        {
            float m = ((_54.iTime * _54.uSpeed) * 0.5) - (rho * 0.449999988079071044921875);
            int k0 = int(mod(floor(m), 4.0));
            if (k0 == 3)
            {
                _311 = 0;
            }
            else
            {
                _311 = k0 + 1;
            }
            int k1 = _311;
            float param_3 = a;
            int param_4 = k0;
            float param_5 = n;
            float param_6 = a;
            int param_7 = k1;
            float param_8 = n;
            R = mix(shapeRadius(param_3, param_4, param_5), shapeRadius(param_6, param_7, param_8), smoothstep(0.300000011920928955078125, 0.699999988079071044921875, fract(m)));
        }
        float cover = smoothstep(-px, px, (rho * R) - rr);
        int param_9 = int(mod(j - base, 4.0) + 0.5);
        col += (flatColour(param_9, _54) * ((1.0 - acc) * cover));
        acc += ((1.0 - acc) * cover);
        if (acc > 0.99500000476837158203125)
        {
            break;
        }
    }
    fragColor = float4(col / float3(fast::max(acc, 0.001000000047497451305389404296875)), 1.0);
}

fragment flair_concentric_shapes_frag_out flair_concentric_shapes_frag(constant FlairUniforms& _54 [[buffer(0)]], float4 gl_FragCoord [[position]])
{
    flair_concentric_shapes_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _399;
    if (_54.flair_flipY > 0.5)
    {
        _399 = _54.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _399 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _399);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _54);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

