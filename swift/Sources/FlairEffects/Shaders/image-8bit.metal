// flair-metal-hash: 39afd8c3
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"
#pragma clang diagnostic ignored "-Wmissing-braces"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

template<typename T, size_t Num>
struct spvUnsafeArray
{
    T elements[Num ? Num : 1];
    
    thread T& operator [] (size_t pos) thread
    {
        return elements[pos];
    }
    constexpr const thread T& operator [] (size_t pos) const thread
    {
        return elements[pos];
    }
    
    device T& operator [] (size_t pos) device
    {
        return elements[pos];
    }
    constexpr const device T& operator [] (size_t pos) const device
    {
        return elements[pos];
    }
    
    constexpr const constant T& operator [] (size_t pos) const constant
    {
        return elements[pos];
    }
    
    threadgroup T& operator [] (size_t pos) threadgroup
    {
        return elements[pos];
    }
    constexpr const threadgroup T& operator [] (size_t pos) const threadgroup
    {
        return elements[pos];
    }
};

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
    int uPalette;
    float uPixel;
    float uDither;
    uint uBayer8;
    float uContrast;
    char _m18_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

constant spvUnsafeArray<float3, 16> _340 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(0.114000000059604644775390625, 0.1689999997615814208984375, 0.324999988079071044921875), float3(0.4939999878406524658203125, 0.14499999582767486572265625, 0.324999988079071044921875), float3(0.0, 0.528999984264373779296875, 0.3179999887943267822265625), float3(0.671000003814697265625, 0.3219999969005584716796875, 0.21199999749660491943359375), float3(0.3729999959468841552734375, 0.3409999907016754150390625, 0.310000002384185791015625), float3(0.760999977588653564453125, 0.76499998569488525390625, 0.7799999713897705078125), float3(1.0, 0.944999992847442626953125, 0.910000026226043701171875), float3(1.0, 0.0, 0.301999986171722412109375), float3(1.0, 0.638999998569488525390625, 0.0), float3(1.0, 0.925000011920928955078125, 0.15299999713897705078125), float3(0.0, 0.893999993801116943359375, 0.21199999749660491943359375), float3(0.16099999845027923583984375, 0.677999973297119140625, 1.0), float3(0.513999998569488525390625, 0.462999999523162841796875, 0.611999988555908203125), float3(1.0, 0.46700000762939453125, 0.658999979496002197265625), float3(1.0, 0.800000011920928955078125, 0.666999995708465576171875) });
constant spvUnsafeArray<float3, 16> _384 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(0.987999975681304931640625), float3(0.736999988555908203125), float3(0.486000001430511474609375), float3(0.658999979496002197265625, 0.063000001013278961181640625, 0.0), float3(0.972999989986419677734375, 0.2199999988079071044921875, 0.0), float3(0.987999975681304931640625, 0.62699997425079345703125, 0.2669999897480010986328125), float3(0.972999989986419677734375, 0.84700000286102294921875, 0.4709999859333038330078125), float3(0.0, 0.3449999988079071044921875, 0.0), float3(0.0, 0.72200000286102294921875, 0.0), float3(0.72200000286102294921875, 0.972999989986419677734375, 0.09399999678134918212890625), float3(0.0, 0.3449999988079071044921875, 0.972999989986419677734375), float3(0.23499999940395355224609375, 0.736999988555908203125, 0.987999975681304931640625), float3(0.40799999237060546875, 0.2669999897480010986328125, 0.987999975681304931640625), float3(0.84700000286102294921875, 0.0, 0.800000011920928955078125), float3(0.31400001049041748046875, 0.1879999935626983642578125, 0.0) });
constant spvUnsafeArray<float3, 16> _417 = spvUnsafeArray<float3, 16>({ float3(0.0), float3(1.0), float3(0.53299999237060546875, 0.0, 0.0), float3(0.666999995708465576171875, 1.0, 0.933000028133392333984375), float3(0.800000011920928955078125, 0.2669999897480010986328125, 0.800000011920928955078125), float3(0.0, 0.800000011920928955078125, 0.333000004291534423828125), float3(0.0, 0.0, 0.666999995708465576171875), float3(0.933000028133392333984375, 0.933000028133392333984375, 0.46700000762939453125), float3(0.86699998378753662109375, 0.53299999237060546875, 0.333000004291534423828125), float3(0.4000000059604644775390625, 0.2669999897480010986328125, 0.0), float3(1.0, 0.46700000762939453125, 0.46700000762939453125), float3(0.20000000298023223876953125), float3(0.46700000762939453125), float3(0.666999995708465576171875, 1.0, 0.4000000059604644775390625), float3(0.0, 0.53299999237060546875, 1.0), float3(0.732999980449676513671875) });
constant spvUnsafeArray<float3, 4> _432 = spvUnsafeArray<float3, 4>({ float3(0.0), float3(0.333000004291534423828125, 1.0, 1.0), float3(1.0, 0.333000004291534423828125, 1.0), float3(1.0) });
constant spvUnsafeArray<float3, 4> _579 = spvUnsafeArray<float3, 4>({ float3(0.05900000035762786865234375, 0.2199999988079071044921875, 0.05900000035762786865234375), float3(0.1879999935626983642578125, 0.384000003337860107421875, 0.1879999935626983642578125), float3(0.545000016689300537109375, 0.675000011920928955078125, 0.05900000035762786865234375), float3(0.607999980449676513671875, 0.736999988555908203125, 0.05900000035762786865234375) });

struct flair_image_8bit_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _69)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_69.uBackdrop) * _69.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_69.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _69)
{
    float4 _213;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _213 = overBackdrop(param, _69);
    }
    else
    {
        float2 param_1 = fract(uv);
        _213 = float4(testCard(param_1), 1.0);
    }
    return _213;
}

static inline __attribute__((always_inline))
float bayer2(thread float2& a)
{
    a = floor(a);
    return fract((a.x / 2.0) + ((a.y * a.y) * 0.75));
}

static inline __attribute__((always_inline))
float bayer4(thread const float2& a)
{
    float2 param = a * 0.5;
    float _253 = bayer2(param);
    float2 param_1 = a;
    float _258 = bayer2(param_1);
    return (_253 * 0.25) + _258;
}

static inline __attribute__((always_inline))
float bayer8(thread const float2& a)
{
    float2 param = a * 0.5;
    float2 param_1 = a;
    float _269 = bayer2(param_1);
    return (bayer4(param) * 0.25) + _269;
}

static inline __attribute__((always_inline))
float3 nearest(thread const float3& c, thread const int& pal)
{
    float3 best = float3(0.0);
    float bestDist = 1000000000.0;
    float3 p;
    for (int i = 0; i < 16; i++)
    {
        if (pal == 1)
        {
            p = _340[i];
        }
        else
        {
            if (pal == 2)
            {
                p = _384[i];
            }
            else
            {
                if (pal == 4)
                {
                    p = _417[i];
                }
                else
                {
                    if (i >= 4)
                    {
                        break;
                    }
                    p = _432[i];
                }
            }
        }
        float3 d = c - p;
        float dist = dot(d * d, float3(0.300000011920928955078125, 0.589999973773956298828125, 0.10999999940395355224609375));
        if (dist < bestDist)
        {
            bestDist = dist;
            best = p;
        }
    }
    return best;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _69, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 cell = floor(fragCoord / float2(_69.uPixel));
    float2 param = ((cell + float2(0.5)) * _69.uPixel) / float2(_69.iResolution[0], _69.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _69);
    float3 src = fast::clamp(((pic.xyz - float3(0.5)) * _69.uContrast) + float3(0.5), float3(0.0), float3(1.0));
    float _504;
    if (_69.uBayer8 != 0u)
    {
        float2 param_1 = cell;
        _504 = bayer8(param_1) + 0.0078125;
    }
    else
    {
        float2 param_2 = cell;
        _504 = bayer4(param_2) + 0.03125;
    }
    float threshold = _504 - 0.5;
    bool _524 = _69.uPalette == 0;
    bool _532;
    if (!_524)
    {
        _532 = _69.uPalette == 5;
    }
    else
    {
        _532 = _524;
    }
    float3 col;
    if (_532)
    {
        float levels = (_69.uPalette == 0) ? 3.0 : 1.0;
        float l = dot(src, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
        int i = int(fast::clamp(floor(((l * levels) + 0.5) + (threshold * _69.uDither)), 0.0, levels));
        float3 _567;
        if (_69.uPalette == 0)
        {
            _567 = _579[i];
        }
        else
        {
            _567 = float3(float(i));
        }
        col = _567;
    }
    else
    {
        float spread = (_69.uPalette == 3) ? 0.550000011920928955078125 : 0.2199999988079071044921875;
        float3 param_3 = src + float3((threshold * _69.uDither) * spread);
        int param_4 = _69.uPalette;
        col = nearest(param_3, param_4);
    }
    fragColor = float4(col, step(0.5, pic.w));
}

fragment flair_image_8bit_frag_out flair_image_8bit_frag(constant FlairUniforms& _69 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_image_8bit_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _630;
    if (_69.flair_flipY > 0.5)
    {
        _630 = _69.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _630 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _630);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _69, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

